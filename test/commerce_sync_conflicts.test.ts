import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  productSyncService,
  commerceSyncWorker,
  platformWebhookService,
  ExternalProductSnapshot
} from '../server/services/platform';
import {
  productRepository,
  inventoryRepository,
  promotionRepository,
  syncConflictRepository,
  externalMappingRepository,
  eventRepository
} from '../server/repositories';
import { db } from '../server/db';
import app from '../server/index';

test('1. Matching Local and External Product - Clean Sync Without Conflicts', async () => {
  const prod = await productRepository.getBySku('SKU-001');
  const inv = await inventoryRepository.get('SKU-001');
  const promo = await promotionRepository.getActiveBySku('SKU-001');

  assert.ok(prod && inv, 'SKU-001 must exist locally');

  const matchingSnapshot: ExternalProductSnapshot[] = [
    {
      externalProductId: 'tt-prod-001',
      externalSku: 'SKU-001',
      title: prod.name,
      price: prod.base_price,
      salePrice: prod.sale_price,
      stock: inv.available_stock,
      status: 'ACTIVE',
      promotion: promo ? {
        promotionId: promo.id,
        title: promo.title,
        discountPercent: promo.discount_percent,
        salePrice: prod.sale_price || prod.base_price,
        startTime: promo.start_time,
        endTime: promo.end_time,
        active: promo.active
      } : null
    }
  ];

  const snapshot = await productSyncService.fetchSnapshot('TIKTOK', matchingSnapshot);
  assert.equal(snapshot.products.length, 1);
  assert.ok(snapshot.isSimulated, 'Unconfigured TikTok adapter must be flagged as simulated');

  const conflicts = await productSyncService.compareAndDetectConflicts(snapshot);
  const sku1Conflicts = conflicts.filter(c => c.entity_id === 'SKU-001');
  assert.equal(sku1Conflicts.length, 0, 'Matching local and external product must produce 0 conflicts');
});

test('2. Inventory Conflict Detection - External Discrepancy Flagged Without Auto-Overwrite', async () => {
  const prod = await productRepository.getBySku('SKU-001');
  const inv = await inventoryRepository.get('SKU-001');
  assert.ok(prod && inv);

  const initialStock = inv.available_stock;
  const externalDifferentStock = initialStock + 10;

  const discrepantSnapshot: ExternalProductSnapshot[] = [
    {
      externalProductId: 'tt-prod-001',
      externalSku: 'SKU-001',
      title: prod.name,
      price: prod.sale_price || prod.base_price,
      stock: externalDifferentStock,
      status: 'ACTIVE'
    }
  ];

  const snapshot = await productSyncService.fetchSnapshot('TIKTOK', discrepantSnapshot);
  const conflicts = await productSyncService.compareAndDetectConflicts(snapshot);

  const invConflict = conflicts.find(c => c.entity_id === 'SKU-001' && c.conflict_type === 'INVENTORY_CONFLICT');
  assert.ok(invConflict, 'Must detect INVENTORY_CONFLICT');
  assert.equal(invConflict.local_value.available_stock, initialStock);
  assert.equal(invConflict.external_value.reported_stock, externalDifferentStock);

  // Invariant: Local authoritative stock must NOT be altered
  const afterInv = await inventoryRepository.get('SKU-001');
  assert.equal(afterInv?.available_stock, initialStock, 'Authoritative stock must NOT be auto-overwritten');
});

test('3. Price Conflict Detection - Discrepant Price Captured', async () => {
  const prod = await productRepository.getBySku('SKU-001');
  const inv = await inventoryRepository.get('SKU-001');
  assert.ok(prod && inv);

  const localPrice = prod.sale_price ?? prod.base_price;
  const externalDivergentPrice = localPrice - 20000; // e.g. 59,000 vs 79,000

  const priceDiscrepantSnapshot: ExternalProductSnapshot[] = [
    {
      externalProductId: 'tt-prod-001',
      externalSku: 'SKU-001',
      title: prod.name,
      price: externalDivergentPrice,
      salePrice: externalDivergentPrice,
      stock: inv.available_stock,
      status: 'ACTIVE'
    }
  ];

  const snapshot = await productSyncService.fetchSnapshot('TIKTOK', priceDiscrepantSnapshot);
  const conflicts = await productSyncService.compareAndDetectConflicts(snapshot);

  const priceConflict = conflicts.find(c => c.entity_id === 'SKU-001' && c.conflict_type === 'PRICE_CONFLICT');
  assert.ok(priceConflict, 'Must detect PRICE_CONFLICT');
  assert.equal(priceConflict.local_value.effective_price, localPrice);
  assert.equal(priceConflict.external_value.effective_price, externalDivergentPrice);

  // Authoritative price untouched
  const afterProd = await productRepository.getBySku('SKU-001');
  assert.equal(afterProd?.sale_price, prod.sale_price);
});

test('4. Promotion Conflict Detection - Unaligned Discount Flagged', async () => {
  const prod = await productRepository.getBySku('SKU-001');
  const inv = await inventoryRepository.get('SKU-001');
  assert.ok(prod && inv);

  const promoConflictSnapshot: ExternalProductSnapshot[] = [
    {
      externalProductId: 'tt-prod-001',
      externalSku: 'SKU-001',
      title: prod.name,
      price: prod.base_price,
      salePrice: prod.sale_price,
      stock: inv.available_stock,
      status: 'ACTIVE',
      promotion: {
        promotionId: 'tt-flash-sale-99',
        title: 'Unauthorized Flash Sale',
        discountPercent: 50, // local is 20%
        salePrice: 49500,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString(),
        active: true
      }
    }
  ];

  const snapshot = await productSyncService.fetchSnapshot('TIKTOK', promoConflictSnapshot);
  const conflicts = await productSyncService.compareAndDetectConflicts(snapshot);

  const promoConflict = conflicts.find(c => c.entity_id === 'SKU-001' && c.conflict_type === 'PROMOTION_CONFLICT');
  assert.ok(promoConflict, 'Must detect PROMOTION_CONFLICT');
  assert.equal(promoConflict.local_value.discount_percent, 20);
  assert.equal(promoConflict.external_value.discountPercent, 50);
});

test('5. Missing Product Mapping Detection (LOCAL_PRODUCT_MISSING)', async () => {
  const unmappedSnapshot: ExternalProductSnapshot[] = [
    {
      externalProductId: 'tt-prod-unknown-999',
      externalSku: 'SKU-UNKNOWN-999',
      title: 'Rogue External Product',
      price: 150000,
      stock: 10,
      status: 'ACTIVE'
    }
  ];

  const snapshot = await productSyncService.fetchSnapshot('TIKTOK', unmappedSnapshot);
  const conflicts = await productSyncService.compareAndDetectConflicts(snapshot);

  const missingConflict = conflicts.find(c => c.entity_id === 'SKU-UNKNOWN-999' && c.conflict_type === 'LOCAL_PRODUCT_MISSING');
  assert.ok(missingConflict, 'Must detect LOCAL_PRODUCT_MISSING');
  assert.equal(missingConflict.external_id, 'tt-prod-unknown-999');
});

test('6. Reusable Sync Worker - Manual & Scheduled Execution Cycle', async () => {
  const report = await commerceSyncWorker.runSync('SHOPEE', 'MANUAL');
  assert.ok(report.runId.startsWith('sync-run-'));
  assert.equal(report.platform, 'SHOPEE');
  assert.equal(report.mode, 'MANUAL');
  assert.ok(report.isSimulated);
  assert.equal(report.status, 'COMPLETED');
  assert.ok(report.recordsExamined >= 0);
  assert.ok(report.durationMs >= 0);
});

test('7. Duplicate Conflict Prevention (Fingerprint Idempotency)', async () => {
  const inv = await inventoryRepository.get('SKU-002');
  assert.ok(inv);

  const snapshotItems: ExternalProductSnapshot[] = [
    {
      externalProductId: 'sp-prod-002',
      externalSku: 'SKU-002',
      title: 'Sunscreen Glow SPF 50+',
      price: 89000,
      stock: inv.available_stock + 15,
      status: 'ACTIVE'
    }
  ];

  const snapshot = await productSyncService.fetchSnapshot('SHOPEE', snapshotItems);

  // Run 1: Detect conflict
  const run1Conflicts = await productSyncService.compareAndDetectConflicts(snapshot);
  const conflict1 = run1Conflicts.find(c => c.entity_id === 'SKU-002' && c.conflict_type === 'INVENTORY_CONFLICT');
  assert.ok(conflict1, 'First run must create conflict');

  // Run 2: Exact same snapshot executed again
  const run2Conflicts = await productSyncService.compareAndDetectConflicts(snapshot);
  const conflict2 = run2Conflicts.find(c => c.entity_id === 'SKU-002' && c.conflict_type === 'INVENTORY_CONFLICT');
  assert.ok(conflict2);

  // Fingerprint and conflict ID must match (idempotent, no duplicates)
  assert.equal(conflict1.id, conflict2.id, 'Duplicate snapshot must return existing conflict ID');
  assert.equal(conflict1.fingerprint, conflict2.fingerprint);
});

test('8. Operator Conflict Resolution: resolveLocal (Keep Authoritative Local)', async () => {
  const testConflict = await syncConflictRepository.create({
    platform: 'TIKTOK',
    entity_type: 'INVENTORY',
    entity_id: 'SKU-RESOLVE-LOCAL',
    external_id: 'tt-resolve-01',
    conflict_type: 'INVENTORY_CONFLICT',
    local_value: { available_stock: 40 },
    external_value: { reported_stock: 50 }
  });

  const res = await productSyncService.resolveLocal(testConflict.id, 'OPERATOR_ALICE', 'Local count verified manually in warehouse');
  assert.ok(res.success);
  assert.equal(res.conflict.status, 'RESOLVED');
  assert.equal(res.conflict.resolution, 'LOCAL_AUTHORITATIVE');
  assert.equal(res.conflict.resolved_by, 'OPERATOR_ALICE');
});

test('9. Operator Conflict Resolution: resolveExternal (Explicit Overwrite of Supabase)', async () => {
  // Setup test inventory
  const testSku = 'SKU-TEST-EXT-RESOLVE';
  await inventoryRepository.update(testSku, 50);

  const testConflict = await syncConflictRepository.create({
    platform: 'SHOPEE',
    entity_type: 'INVENTORY',
    entity_id: testSku,
    external_id: 'sp-ext-01',
    conflict_type: 'INVENTORY_CONFLICT',
    local_value: { available_stock: 50 },
    external_value: { reported_stock: 65 }
  });

  const res = await productSyncService.resolveExternal(testConflict.id, 'OPERATOR_BOB', 'Shopee seller center confirmed batch arrival');
  assert.ok(res.success);
  assert.equal(res.conflict.status, 'RESOLVED');
  assert.equal(res.conflict.resolution, 'EXTERNAL_OVERWRITE');

  // Verify Supabase / local inventory updated to 65
  const updatedInv = await inventoryRepository.get(testSku);
  assert.equal(updatedInv?.available_stock, 65, 'External resolution must update authoritative available stock');
});

test('10. Operator Conflict Resolution: resolveManual (Approved Custom Value)', async () => {
  const testSku = 'SKU-TEST-MANUAL';
  await inventoryRepository.update(testSku, 30);

  const testConflict = await syncConflictRepository.create({
    platform: 'TIKTOK',
    entity_type: 'INVENTORY',
    entity_id: testSku,
    external_id: 'tt-manual-01',
    conflict_type: 'INVENTORY_CONFLICT',
    local_value: { available_stock: 30 },
    external_value: { reported_stock: 80 }
  });

  // Operator compromises at 45 units after physical cycle count
  const res = await productSyncService.resolveManual(testConflict.id, { available_stock: 45 }, 'OPERATOR_CHARLIE', 'Warehouse physical count confirmed 45');
  assert.ok(res.success);
  assert.equal(res.conflict.status, 'RESOLVED');
  assert.equal(res.conflict.resolution, 'MANUAL_VALUE');

  const updatedInv = await inventoryRepository.get(testSku);
  assert.equal(updatedInv?.available_stock, 45, 'Manual resolution must update authoritative available stock');
});

test('11. Full Audit Trail Verification for Conflict Resolution Lifecycle', async () => {
  const auditLogs = db.getAuditLogs();
  const conflictAudits = auditLogs.filter(a => a.action === 'SYNC_CONFLICT_RESOLVED' || a.action === 'SYNC_CONFLICT_DETECTED');
  assert.ok(conflictAudits.length > 0, 'Audit logs must record conflict detection and resolutions');
  assert.ok(conflictAudits.some(a => a.target.includes('LOCAL_AUTHORITATIVE') || a.target.includes('EXTERNAL_OVERWRITE') || a.target.includes('MANUAL_VALUE')));
});

test('12. Critical Inventory Safety: Active Reservations Preserved During Sync Resolution', async () => {
  const testSku = 'SKU-RESERVATION-SAFE';
  // Total: 100, Reserved: 20 -> Available: 80
  await inventoryRepository.update(testSku, 100);
  await inventoryRepository.reserve(testSku, 20);

  const beforeInv = await inventoryRepository.get(testSku);
  assert.equal(beforeInv?.reserved_stock, 20);
  assert.equal(beforeInv?.available_stock, 80);

  // External platform reports 90 available units
  const testConflict = await syncConflictRepository.create({
    platform: 'TIKTOK',
    entity_type: 'INVENTORY',
    entity_id: testSku,
    external_id: 'tt-res-01',
    conflict_type: 'INVENTORY_CONFLICT',
    local_value: { available_stock: 80, total_stock: 100, reserved_stock: 20 },
    external_value: { reported_stock: 90 }
  });

  // Operator accepts external stock
  await productSyncService.resolveExternal(testConflict.id, 'OPERATOR');

  const afterInv = await inventoryRepository.get(testSku);
  // Reservation safety: reserved_stock MUST still be 20, total becomes 90 + 20 = 110, available is 90
  assert.equal(afterInv?.reserved_stock, 20, 'CRITICAL: Active reservations must NOT be wiped out by sync resolution');
  assert.equal(afterInv?.available_stock, 90, 'Available stock updated to external count');
});

test('13. Simulated Platform Handling - Clear DEMO/SIMULATED Marking', async () => {
  const snapshot = await productSyncService.fetchSnapshot('TIKTOK');
  assert.equal(snapshot.isSimulated, true, 'Uncredentialed sandbox must be marked simulated');

  const report = await commerceSyncWorker.runSync('TIKTOK', 'MANUAL');
  assert.equal(report.isSimulated, true, 'Worker report must reflect simulated status');
});

test('14. Webhook Architecture & Idempotency Filter', async () => {
  platformWebhookService.clearEventCache();

  const webhookPayload = {
    event_id: 'evt-test-webhook-dedup-001',
    event_type: 'INVENTORY_CHANGED',
    data: { sku: 'SKU-001', stock: 25 },
    timestamp: Date.now()
  };

  // First ingestion
  const res1 = await platformWebhookService.handleWebhook('TIKTOK', webhookPayload);
  assert.ok(res1.handled);
  assert.equal(res1.deduplicated, false);

  // Duplicate ingestion of same event_id
  const res2 = await platformWebhookService.handleWebhook('TIKTOK', webhookPayload);
  assert.ok(res2.handled);
  assert.equal(res2.deduplicated, true, 'Duplicate webhook event must be safely dropped by idempotency filter');
});

test('15. Sync Failure and Resilient Error Recording', async () => {
  // Trigger sync on an invalid platform
  const report = await commerceSyncWorker.runSync('INVALID_PLATFORM' as any, 'MANUAL');
  assert.equal(report.status, 'FAILED');
  assert.ok(report.error && report.error.length > 0);
  assert.equal(report.recordsExamined, 0);

  // Verify failure recorded in syncRuns
  const runs = db.getSyncRuns('INVALID_PLATFORM' as any);
  assert.ok(runs.some(r => r.status === 'FAILED'));
});
