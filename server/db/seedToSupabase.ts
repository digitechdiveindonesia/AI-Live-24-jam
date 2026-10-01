import { supabaseManager } from './supabaseClient';
import {
  SEED_PRODUCTS,
  SEED_VARIANTS,
  SEED_INVENTORY,
  SEED_PROMOTIONS,
  SEED_FAQS,
  SEED_DOCUMENTS,
  SEED_RULES
} from './seed';

/**
 * Explicit seed script to bootstrap development data into Supabase PostgreSQL.
 * Will NOT automatically overwrite real production data unless specifically requested.
 */
export async function seedSupabase(force: boolean = false): Promise<void> {
  console.log('[Seed] Starting Supabase database bootstrap...');

  if (!supabaseManager.isConfigured()) {
    console.warn('[Seed] Supabase is NOT configured in .env. Skipping cloud bootstrap.');
    console.warn('[Seed] To seed Supabase, configure SUPABASE_URL and SUPABASE_SECRET_KEY.');
    return;
  }

  const client = supabaseManager.getClient();
  if (!client) {
    console.error('[Seed] Could not obtain Supabase client.');
    return;
  }

  // 1. Safety Check: Check if products table is already populated
  const { data: existingProducts, error: checkError } = await client
    .from('products')
    .select('id')
    .limit(1);

  if (checkError) {
    console.error('[Seed] Error checking existing products in Supabase:', checkError.message);
    return;
  }

  if (existingProducts && existingProducts.length > 0 && !force) {
    console.log('[Seed] Supabase products table already contains data. Skipping to prevent overwriting production truth.');
    console.log('[Seed] Pass force=true to override existing development data.');
    return;
  }

  console.log('[Seed] Seeding core commerce entities into Supabase...');

  // 2. Seed Products
  const { error: prodErr } = await client.from('products').upsert(SEED_PRODUCTS, { onConflict: 'sku' });
  if (prodErr) console.error('[Seed] Failed to seed products:', prodErr.message);
  else console.log(`[Seed] Seeded ${SEED_PRODUCTS.length} products.`);

  // 3. Seed Variants
  const { error: varErr } = await client.from('product_variants').upsert(SEED_VARIANTS, { onConflict: 'sku' });
  if (varErr) console.error('[Seed] Failed to seed variants:', varErr.message);
  else console.log(`[Seed] Seeded ${SEED_VARIANTS.length} variants.`);

  // 4. Seed Inventory
  const { error: invErr } = await client.from('inventory').upsert(SEED_INVENTORY, { onConflict: 'sku' });
  if (invErr) console.error('[Seed] Failed to seed inventory:', invErr.message);
  else console.log(`[Seed] Seeded ${SEED_INVENTORY.length} inventory records.`);

  // 5. Seed Promotions
  const { error: promoErr } = await client.from('promotions').upsert(SEED_PROMOTIONS, { onConflict: 'id' });
  if (promoErr) console.error('[Seed] Failed to seed promotions:', promoErr.message);
  else console.log(`[Seed] Seeded ${SEED_PROMOTIONS.length} promotions.`);

  // 6. Seed FAQs
  const { error: faqErr } = await client.from('product_faq').upsert(SEED_FAQS, { onConflict: 'id' });
  if (faqErr) console.error('[Seed] Failed to seed FAQs:', faqErr.message);
  else console.log(`[Seed] Seeded ${SEED_FAQS.length} FAQs.`);

  // 7. Seed Knowledge Documents
  const { error: docErr } = await client.from('knowledge_documents').upsert(SEED_DOCUMENTS, { onConflict: 'id' });
  if (docErr) console.error('[Seed] Failed to seed documents:', docErr.message);
  else console.log(`[Seed] Seeded ${SEED_DOCUMENTS.length} knowledge documents.`);

  // 8. Seed Knowledge Rules
  const { error: ruleErr } = await client.from('knowledge_rules').upsert(SEED_RULES, { onConflict: 'id' });
  if (ruleErr) console.error('[Seed] Failed to seed rules:', ruleErr.message);
  else console.log(`[Seed] Seeded ${SEED_RULES.length} knowledge rules.`);

  console.log('[Seed] Supabase seed completed successfully.');
}

if (process.argv[1]?.includes('seedToSupabase')) {
  const force = process.argv.includes('--force');
  seedSupabase(force).then(() => process.exit(0)).catch(err => {
    console.error('[Seed] Fatal error:', err);
    process.exit(1);
  });
}
