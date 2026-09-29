import test from 'node:test';
import assert from 'node:assert';
import { db } from '../server/db/index.ts';
import { productVerificationService } from '../server/services/ProductService.ts';
import { intentService } from '../server/services/IntentService.ts';
import { guardrailService } from '../server/services/GuardrailService.ts';
import { hostStateMachineService } from '../server/services/HostStateMachineService.ts';
import { responseService } from '../server/services/ResponseService.ts';
import { questionQueue } from '../server/services/QuestionQueue.ts';
import { interruptionEngine } from '../server/services/InterruptionEngine.ts';
import { conversationContextService } from '../server/services/ConversationContextService.ts';
import { geminiService } from '../server/services/GeminiService.ts';
import { conversationOrchestrator } from '../server/services/ConversationOrchestrator.ts';
import { eventService } from '../server/services/EventService.ts';

test('1. Database and ProductVerificationService - Authoritative Source of Truth', () => {
  const verified = productVerificationService.verifyProductData('SKU-001');
  assert.ok(verified, 'SKU-001 must exist');
  assert.strictEqual(verified.sku, 'SKU-001');
  assert.strictEqual(verified.totalStock, 23);
  assert.strictEqual(verified.salePriceFormatted, 'Rp79.000');
  assert.strictEqual(verified.discountPercent, 20);
});

test('2. Customer Conversation Model and Status Tracking', () => {
  const conv = db.getOrCreateConversation('LIVE-001', 'cust-test-user', 'Maya S.', '@maya_skincare', 'TikTok');
  assert.ok(conv.conversation_id);
  assert.strictEqual(conv.status, 'ACTIVE');

  // Customer message
  const msg1 = db.addConversationMessage(conv.conversation_id, 'CUSTOMER', 'Ada potongan harga gak kak?');
  assert.strictEqual(msg1.role, 'CUSTOMER');

  // AI response message
  const msg2 = db.addConversationMessage(conv.conversation_id, 'AI', 'Ada kak, diskon 20% khusus live!', {
    intent: 'PRICE_QUESTION'
  });
  assert.strictEqual(msg2.role, 'AI');

  // Status updates
  db.updateConversationStatus(conv.conversation_id, 'ESCALATED');
  assert.strictEqual(db.getConversationById(conv.conversation_id)?.status, 'ESCALATED');
});

test('3. Message Priority System and QuestionQueue', () => {
  // Test priority classification
  assert.strictEqual(questionQueue.determinePriority('Pesanan saya kenapa belum sampai?'), 'CRITICAL');
  assert.strictEqual(questionQueue.determinePriority('Ukuran yang tersedia apa aja?'), 'HIGH');
  assert.strictEqual(questionQueue.determinePriority('Ini harganya berapa?'), 'NORMAL');
  assert.strictEqual(questionQueue.determinePriority('Bagus nih produknya kak semangat!'), 'LOW');

  // Test Queue prioritization (CRITICAL should jump ahead of NORMAL)
  questionQueue.clear();

  questionQueue.enqueue({
    id: 'q-normal',
    message: 'Harganya berapa kak?',
    conversationId: 'conv-1',
    priority: 'NORMAL',
    intent: 'PRICE_QUESTION',
    productId: 'SKU-001',
    createdAt: new Date(Date.now() - 1000).toISOString(),
    status: 'QUEUED'
  });

  questionQueue.enqueue({
    id: 'q-critical',
    message: 'Paket saya bocor kak gimana nih!',
    conversationId: 'conv-2',
    priority: 'CRITICAL',
    intent: 'COMPLAINT',
    productId: 'SKU-001',
    createdAt: new Date().toISOString(),
    status: 'QUEUED'
  });

  const nextQuestion = questionQueue.dequeue();
  assert.ok(nextQuestion);
  assert.strictEqual(nextQuestion.id, 'q-critical', 'Critical question must be dequeued first');
  assert.strictEqual(nextQuestion.priority, 'CRITICAL');
});

test('4. InterruptionEngine - Script Preservation and Non-Restarting Resumption', () => {
  hostStateMachineService.transitionTo('PROMO');

  // Selling can be interrupted by a NORMAL price question
  const decision = interruptionEngine.evaluateInterruption('Berapa harganya?', 'NORMAL', 'PRICE_QUESTION');
  assert.strictEqual(decision.canInterrupt, true);
  assert.strictEqual(decision.action, 'INTERRUPT_NOW');
  assert.ok(decision.preservedPosition);
  assert.strictEqual(decision.preservedPosition.stepName, 'PROMO');

  // Trigger interruption
  interruptionEngine.beginInterruption('Berapa harganya?', decision.preservedPosition);
  assert.strictEqual(interruptionEngine.getState(), 'INTERRUPTING');

  // Start answering
  interruptionEngine.startAnswering('Serum X sekarang diskon jadi Rp79.000');
  assert.strictEqual(interruptionEngine.getState(), 'ANSWERING');

  // Verify another question cannot overlap while answering
  const overlapDecision = interruptionEngine.evaluateInterruption('Ada COD?', 'NORMAL', 'SHIPPING_QUESTION');
  assert.strictEqual(overlapDecision.canInterrupt, false);
  assert.strictEqual(overlapDecision.action, 'QUEUE');

  // Complete answer and resume selling: MUST NOT restart INTRO
  const completion = interruptionEngine.completeAnswerAndResume('PRICE_QUESTION', 'SKU-001');
  assert.strictEqual(completion.resumeStep, 'PROMO', 'Must resume from preserved PROMO step, not restart INTRO');
  assert.ok(completion.transitionBridge.length > 0);
  assert.strictEqual(interruptionEngine.getState(), 'SELLING');
});

test('5. ConversationContextService - Controlled Context Windowing', () => {
  const conv = db.getOrCreateConversation('LIVE-001', 'cust-ctx-test', 'Lina', '@lina_test');
  conversationContextService.recordCustomerTurn(conv.conversation_id, 'Kak serumnya lengket gak?');
  conversationContextService.recordAiTurn(conv.conversation_id, 'Enggak lengket sama sekali kak!');

  const formattedPrompt = conversationContextService.formatContextForPrompt(conv.conversation_id, 'SKU-001');
  assert.ok(formattedPrompt.includes('Lina: "Kak serumnya lengket gak?"'));
  assert.ok(formattedPrompt.includes('Sari (Host): "Enggak lengket sama sekali kak!"'));
});

test('6. Gemini Structured Response Contract and Grounded Facts', async () => {
  const verified = productVerificationService.verifyProductData('SKU-001');
  const structured = await geminiService.generateStructuredResponse(
    'Berapa harganya kak?',
    {
      sku: verified.sku,
      name: verified.name,
      price: verified.salePriceFormatted,
      normalPrice: 'Rp99.000',
      stock: verified.totalStock,
      promo: verified.promoTitle,
      usage: verified.approvedClaims.join('. '),
      shipping: 'Bisa COD ke seluruh Indonesia'
    },
    ['Rule: BPOM NA18231900452']
  );

  assert.strictEqual(structured.productId, 'SKU-001');
  assert.strictEqual(structured.intent, 'PRICE_QUESTION');
  assert.ok(structured.response.includes('79.000'), 'Response must ground accurate verified price');
  assert.ok(!structured.response.includes('*'), 'Must not have markdown asterisks for spoken TTS');
  assert.strictEqual(structured.requiresHumanReview, false);
  assert.strictEqual(structured.shouldContinueSelling, true);
});

test('7. GuardrailService - Blocks Prohibited BPOM Claims', () => {
  const verified = productVerificationService.verifyProductData('SKU-001');
  const result = guardrailService.auditResponse(
    'Dijamin memutihkan dalam 3 hari dan sembuh total jerawat permanen!',
    verified
  );
  assert.strictEqual(result.status, 'MODIFIED');
  assert.ok(result.violationsDetected.length >= 1);
  assert.ok(!result.sanitizedText.includes('memutihkan dalam 3 hari'));
});

test('8. ConversationOrchestrator - Full 17-Stage Real-Time Pipeline and Events', async () => {
  const capturedEvents: string[] = [];
  const unsubscribeCustomer = eventService.subscribe('CUSTOMER_MESSAGE', (type) => capturedEvents.push(type));
  const unsubscribeAiStart = eventService.subscribe('AI_RESPONSE_STARTED', (type) => capturedEvents.push(type));
  const unsubscribeAiDone = eventService.subscribe('AI_RESPONSE_COMPLETED', (type) => capturedEvents.push(type));
  const unsubscribeReturn = eventService.subscribe('RETURN_TO_SELLING', (type) => capturedEvents.push(type));

  const result = await conversationOrchestrator.handleCustomerMessage('LIVE-001', {
    text: 'Ini harganya berapa ya kak?',
    author: 'Clarissa Wardani',
    handle: '@clarissa_w',
    platform: 'TikTok',
    sku: 'SKU-001',
    skipTtsDelay: true
  });

  assert.strictEqual(result.detectedIntent, 'PRICE_QUESTION');
  assert.strictEqual(result.matchedSku, 'SKU-001');
  assert.strictEqual(result.verifiedPrice, 'Rp79.000');
  assert.strictEqual(result.guardrailStatus, 'APPROVED');
  assert.strictEqual(result.interruptionAction, 'INTERRUPTED');
  assert.strictEqual(result.resumeStep, 'PROMO', 'Selling resumes at PROMO, not INTRO');
  assert.ok(result.transitionBridge.length > 0);

  // Verify event stream observability
  assert.ok(capturedEvents.includes('CUSTOMER_MESSAGE'), 'CUSTOMER_MESSAGE event emitted');
  assert.ok(capturedEvents.includes('AI_RESPONSE_STARTED'), 'AI_RESPONSE_STARTED event emitted');
  assert.ok(capturedEvents.includes('AI_RESPONSE_COMPLETED'), 'AI_RESPONSE_COMPLETED event emitted');
  assert.ok(capturedEvents.includes('RETURN_TO_SELLING'), 'RETURN_TO_SELLING event emitted');

  unsubscribeCustomer();
  unsubscribeAiStart();
  unsubscribeAiDone();
  unsubscribeReturn();
});
