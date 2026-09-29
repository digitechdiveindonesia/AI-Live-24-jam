import test from 'node:test';
import assert from 'node:assert';
import { db } from '../server/db/index.ts';
import { MockTTSProvider, ttsProviderFactory } from '../server/services/TTSProvider.ts';
import { MockAvatarProvider, avatarProviderFactory } from '../server/services/AvatarProvider.ts';
import { voiceOrchestrator } from '../server/services/VoiceOrchestrator.ts';
import { speechScriptService } from '../server/services/SpeechScriptService.ts';
import { liveSessionOrchestrator } from '../server/services/LiveSessionOrchestrator.ts';
import { hostStateMachineService } from '../server/services/HostStateMachineService.ts';
import { questionQueue } from '../server/services/QuestionQueue.ts';
import { eventService } from '../server/services/EventService.ts';

test('1. TTS Provider Interface and MockTTS Lifecycle', async () => {
  const provider = new MockTTSProvider();
  await provider.initialize();
  assert.strictEqual(provider.getStatus(), 'IDLE');

  const lifecycleEvents: string[] = [];
  const unsubRequested = eventService.subscribe('TTS_REQUESTED', (type) => lifecycleEvents.push(type));
  const unsubStarted = eventService.subscribe('TTS_STARTED', (type) => lifecycleEvents.push(type));
  const unsubReady = eventService.subscribe('TTS_READY', (type) => lifecycleEvents.push(type));

  const result = await provider.synthesize('Serum X sekarang lagi promo kak!', {
    skipDelay: true
  });

  assert.strictEqual(result.status, 'READY');
  assert.strictEqual(result.metadata.provider, 'MOCK');
  assert.strictEqual(result.metadata.isSimulated, true);
  assert.ok(result.duration >= 700);

  assert.ok(lifecycleEvents.includes('TTS_REQUESTED'));
  assert.ok(lifecycleEvents.includes('TTS_STARTED'));
  assert.ok(lifecycleEvents.includes('TTS_READY'));

  unsubRequested();
  unsubStarted();
  unsubReady();
});

test('2. Avatar Provider Interface and MockAvatar Simulation', async () => {
  const avatar = new MockAvatarProvider();
  const session = await avatar.initialize({
    sessionId: 'LIVE-001',
    avatarId: 'avatar-sari-01'
  });

  assert.strictEqual(session.state, 'READY');
  assert.strictEqual(avatar.getStatus(), 'READY');

  const avatarEvents: string[] = [];
  const unsubStarted = eventService.subscribe('AVATAR_STARTED', (type) => avatarEvents.push(type));
  const unsubSpeaking = eventService.subscribe('AVATAR_SPEAKING', (type) => avatarEvents.push(type));
  const unsubCompleted = eventService.subscribe('AVATAR_COMPLETED', (type) => avatarEvents.push(type));

  const mockAudio = {
    audioId: 'mock-audio-01',
    duration: 1000,
    status: 'READY' as const,
    format: 'mp3',
    sampleRate: 24000,
    metadata: {
      provider: 'MOCK',
      voiceId: 'id-ID-SariLiveNeural',
      textLength: 30,
      generatedAt: new Date().toISOString(),
      latencyMs: 50,
      isSimulated: true
    }
  };

  const speakResult = await avatar.speak(mockAudio, { skipDelay: true });
  assert.strictEqual(speakResult.status, 'READY');
  assert.strictEqual(speakResult.avatarId, 'avatar-sari-01');

  assert.ok(avatarEvents.includes('AVATAR_STARTED'));
  assert.ok(avatarEvents.includes('AVATAR_SPEAKING'));
  assert.ok(avatarEvents.includes('AVATAR_COMPLETED'));

  unsubStarted();
  unsubSpeaking();
  unsubCompleted();
});

test('3. Dynamic Product Variables in SpeechScriptService', () => {
  const template = 'Halo kak, {{product_name}} harga normal {{price}} lagi promo jadi {{sale_price}}! Sisa stok {{stock}} botol.';
  const resolved = speechScriptService.resolveVariables(template, 'SKU-001');

  assert.ok(resolved.includes('Serum X – Brightening Booster'));
  assert.ok(resolved.includes('Rp99.000'));
  assert.ok(resolved.includes('Rp79.000'));
  assert.ok(resolved.includes('23'));
  assert.ok(!resolved.includes('{{'));

  // Test TTS Sanitization
  const markdownText = '### **Serum X Promo**\n- Diskon 20%\n* Klik keranjang kuning!';
  const sanitized = speechScriptService.sanitizeForTTS(markdownText);
  assert.strictEqual(sanitized, 'Serum X Promo Diskon 20% Klik keranjang kuning!');
});

test('4. Voice Orchestration with Guardrail Check', async () => {
  // Test safe approved speech
  const approvedResult = await voiceOrchestrator.speakResponse(
    'Serum X sekarang lagi promo jadi Rp79.000 dari normal Rp99.000 ya kak!',
    { sku: 'SKU-001', skipDelay: true }
  );
  assert.strictEqual(approvedResult.guardrailStatus, 'APPROVED');
  assert.strictEqual(approvedResult.status, 'PLAYED');
  assert.ok(approvedResult.durationMs > 0);

  // Test prohibited claim blocked before TTS synthesis
  const blockedResult = await voiceOrchestrator.speakResponse(
    'Serum X dijamin memutihkan kulit dalam 3 hari dan sembuh total jerawat permanen!',
    { sku: 'SKU-001', skipDelay: true }
  );
  assert.strictEqual(blockedResult.guardrailStatus, 'MODIFIED');
  assert.ok(!blockedResult.spokenText.includes('memutihkan kulit dalam 3 hari'));
});

test('5. Speech Interruption and SpeechResumeContext Saving', async () => {
  // Start speaking in host state
  hostStateMachineService.transitionTo('PROMO');
  hostStateMachineService.transitionTo('SPEAKING');

  // Customer question interrupts speech
  const resumeCtx = await voiceOrchestrator.interrupt('CUSTOMER_QUESTION');
  assert.ok(resumeCtx);
  assert.strictEqual(hostStateMachineService.getState(), 'INTERRUPTED');
  assert.strictEqual(resumeCtx.productId, 'SKU-001');
  assert.ok(resumeCtx.interruptedAt);
  assert.strictEqual(db.speechResumeContext?.scriptBlockId, 'sb-5');
});

test('6. Configuration-Driven Provider Switching', () => {
  assert.strictEqual(ttsProviderFactory.getCurrentProviderMode(), 'MOCK');
  ttsProviderFactory.setProvider('EXTERNAL');
  assert.strictEqual(ttsProviderFactory.getCurrentProviderMode(), 'EXTERNAL');
  assert.strictEqual(ttsProviderFactory.getProvider().providerName, 'EXTERNAL');

  // Reset to MOCK
  ttsProviderFactory.setProvider('MOCK');
  assert.strictEqual(ttsProviderFactory.getProvider().providerName, 'MOCK');

  assert.strictEqual(avatarProviderFactory.getCurrentProviderMode(), 'MOCK');
  avatarProviderFactory.setProvider('EXTERNAL');
  assert.strictEqual(avatarProviderFactory.getProvider().providerName, 'EXTERNAL');
  avatarProviderFactory.setProvider('MOCK');
});

test('7. Operator Controls: Take Over, Pause, and Return to AI', async () => {
  // Pause AI
  await liveSessionOrchestrator.pauseAi();
  assert.strictEqual(db.session.is_ai_host_on, false);
  assert.strictEqual(db.session.is_paused, true);
  assert.strictEqual(hostStateMachineService.getState(), 'PAUSED');

  // Resume AI
  await liveSessionOrchestrator.resumeAi();
  assert.strictEqual(db.session.is_ai_host_on, true);
  assert.strictEqual(db.session.is_paused, false);

  // Take Over Mic
  await liveSessionOrchestrator.takeoverMic();
  assert.strictEqual(db.session.is_mic_takeover, true);
  assert.strictEqual(hostStateMachineService.getState(), 'HUMAN_TAKEOVER');

  // Release Mic
  await liveSessionOrchestrator.releaseMic();
  assert.strictEqual(db.session.is_mic_takeover, false);
});

test('8. Deterministic Demo Scenario (Section 20)', async () => {
  // 1. Host is in autonomous selling loop at PROMO step
  hostStateMachineService.transitionTo('PROMO');
  assert.strictEqual(hostStateMachineService.getState(), 'PROMO');

  // 2. Customer asks price: "Harganya berapa kak?"
  const result = await liveSessionOrchestrator.handleCustomerInteraction(
    'Harganya berapa kak?',
    'Rina Sasmita',
    '@rina_beauty',
    'TikTok',
    { skipDelay: true, sku: 'SKU-001' }
  );

  // 3. Verify pipeline outcomes
  assert.strictEqual(result.detectedIntent, 'PRICE_QUESTION');
  assert.strictEqual(result.verifiedPrice, 'Rp79.000');
  assert.strictEqual(result.interruptionAction, 'INTERRUPTED');
  assert.ok(result.generatedResponse.includes('79.000'));
  assert.ok(result.transitionBridge.length > 0);

  // 4. Host resumes selling without restarting script from INTRO
  assert.strictEqual(result.resumeStep, 'PROMO');
  assert.strictEqual(hostStateMachineService.getState(), 'PROMO');
});

test('9. Multi-Question Sequential Draining (Section 21)', async () => {
  questionQueue.clear();

  // Enqueue 2 customer questions
  questionQueue.enqueue({
    id: 'q-stok',
    message: 'Stoknya masih ada gak kak?',
    conversationId: 'conv-b',
    priority: 'NORMAL',
    intent: 'STOCK_QUESTION',
    productId: 'SKU-001',
    createdAt: new Date().toISOString(),
    status: 'QUEUED'
  });

  questionQueue.enqueue({
    id: 'q-varian',
    message: 'Variannya apa aja kak?',
    conversationId: 'conv-c',
    priority: 'HIGH',
    intent: 'VARIANT_QUESTION',
    productId: 'SKU-001',
    createdAt: new Date().toISOString(),
    status: 'QUEUED'
  });

  assert.strictEqual(questionQueue.getAll().length, 2);

  // LiveSessionOrchestrator drains queue sequentially without overlapping audio
  const drainedCount = await liveSessionOrchestrator.processQuestionQueue('SKU-001', true);
  assert.strictEqual(drainedCount, 2);
  assert.strictEqual(questionQueue.peek(), undefined, 'Question queue must be empty after sequential processing');
});

test('10. Voice Telemetry and Observability Recording', async () => {
  await voiceOrchestrator.speakResponse('Uji coba telemetri suara', {
    sku: 'SKU-001',
    skipDelay: true
  });

  assert.ok(db.voiceTelemetries.length > 0);
  const latest = db.voiceTelemetries[0];
  assert.strictEqual(latest.status, 'SUCCESS');
  assert.strictEqual(latest.isSimulated, true);
  assert.ok(latest.ttsDurationMs > 0);
  assert.ok(latest.voiceLatencyMs >= 0);
});
