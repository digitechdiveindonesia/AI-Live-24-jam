import { db } from '../db';
import { guardrailService } from './GuardrailService';
import { productVerificationService } from './ProductService';
import { hostStateMachineService } from './HostStateMachineService';
import { ttsProviderFactory, TTSResult, MockTTSProvider } from './TTSProvider';
import { avatarProviderFactory } from './AvatarProvider';
import { eventService } from './EventService';
import { VoiceTelemetry, SpeechResumeContext } from '../db/schema';

export interface VoiceSessionContext {
  sessionId?: string;
  sku?: string;
  intent?: string;
  priority?: string;
  source?: 'CUSTOMER_ANSWER' | 'AUTONOMOUS_SCRIPT' | 'OPERATOR';
  skipDelay?: boolean;
  metadata?: Record<string, any>;
}

export interface VoicePlaybackResult {
  audioId: string;
  spokenText: string;
  guardrailStatus: 'APPROVED' | 'MODIFIED' | 'BLOCKED';
  durationMs: number;
  voiceLatencyMs: number;
  ttsGenerationMs: number;
  avatarDurationMs: number;
  status: 'PLAYED' | 'INTERRUPTED' | 'DEGRADED' | 'BLOCKED';
  provider: string;
  isSimulated: boolean;
}

export class VoiceOrchestrator {
  private isSpeakingState: boolean = false;
  private currentAudioId: string | null = null;
  private currentSpokenText: string = '';
  private currentContext: VoiceSessionContext | null = null;
  private speechStartTime: number = 0;

  public isSpeaking(): boolean {
    return this.isSpeakingState;
  }

  public getCurrentAudioId(): string | null {
    return this.currentAudioId;
  }

  /**
   * Primary method: receives approved AI text, validates guardrails, generates TTS, and coordinates Avatar speech.
   */
  public async speakResponse(
    response: string,
    sessionContext: VoiceSessionContext = {}
  ): Promise<VoicePlaybackResult> {
    const startTime = Date.now();
    const sessionId = sessionContext.sessionId || db.session.id || 'LIVE-001';
    const sku = sessionContext.sku || db.session.current_sku || 'SKU-001';
    this.currentContext = sessionContext;
    this.speechStartTime = startTime;

    // 1. Final Safety & Guardrail Check before speech generation
    const verifiedFacts = productVerificationService.verifyProductData(sku);
    let finalSpokenText = response;
    let guardrailStatus: 'APPROVED' | 'MODIFIED' | 'BLOCKED' = 'APPROVED';

    if (verifiedFacts) {
      const guardrailAudit = guardrailService.auditResponse(response, verifiedFacts);
      guardrailStatus = guardrailAudit.status;

      if (guardrailStatus === 'BLOCKED') {
        eventService.emit('VOICE_BLOCKED', {
          sessionId,
          reason: 'Response blocked by guardrail policy before TTS synthesis',
          violations: guardrailAudit.violationsDetected,
          timestamp: new Date().toISOString()
        });

        // Safe fallback text that is approved
        finalSpokenText = `Yuk amankan promo spesial ${verifiedFacts.name} diskon 20% langsung di keranjang kuning ya kak!`;
      } else if (guardrailStatus === 'MODIFIED') {
        finalSpokenText = guardrailAudit.sanitizedText;
      }
    }

    // 2. Transition Host State to SPEECH_PREPARING
    hostStateMachineService.transitionTo('SPEECH_PREPARING', `Preparing voice audio: "${finalSpokenText.substring(0, 30)}..."`);

    const ttsProvider = ttsProviderFactory.getProvider();
    const avatarProvider = avatarProviderFactory.getProvider();

    let ttsResult: TTSResult | null = null;
    let ttsGenTimeMs = 0;
    let isVoiceDegraded = false;

    // 3. TTS Speech Generation
    try {
      const ttsStart = Date.now();
      ttsResult = await ttsProvider.synthesize(finalSpokenText, {
        priority: sessionContext.priority,
        skipDelay: sessionContext.skipDelay
      });
      ttsGenTimeMs = Date.now() - ttsStart;
    } catch (err: any) {
      console.warn('[VoiceOrchestrator] TTS Provider failed, degrading to text fallback:', err.message);
      isVoiceDegraded = true;
      eventService.emit('VOICE_DEGRADED', {
        sessionId,
        error: err.message,
        fallback: 'TEXT_ONLY_RESPONSE',
        timestamp: new Date().toISOString()
      });
    }

    // If TTS completely failed, fallback to simulated mock TTS so live commerce never crashes
    if (!ttsResult) {
      const mock = new MockTTSProvider();
      ttsResult = await mock.synthesize(finalSpokenText, { skipDelay: sessionContext.skipDelay });
    }

    this.currentAudioId = ttsResult.audioId;
    this.currentSpokenText = finalSpokenText;
    this.isSpeakingState = true;

    // 4. Transition Host State to SPEAKING
    hostStateMachineService.transitionTo('SPEAKING', `Speaking audio ${ttsResult.audioId}`);

    // 5. Coordinate Avatar Playback Synchronized with Audio
    let avatarDurationMs = 0;
    const avatarStart = Date.now();

    try {
      const avatarResult = await avatarProvider.speak(ttsResult, {
        skipDelay: sessionContext.skipDelay
      });
      avatarDurationMs = avatarResult.durationMs;
    } catch (err: any) {
      console.warn('[VoiceOrchestrator] Avatar Provider failed, audio continues:', err.message);
      eventService.emit('AVATAR_DEGRADED', {
        sessionId,
        error: err.message,
        timestamp: new Date().toISOString()
      });
      // Allow audio to complete even if visual avatar failed
      if (ttsProvider instanceof MockTTSProvider) {
        await ttsProvider.play(ttsResult, sessionContext.skipDelay ?? false);
      }
    }

    const totalDuration = ttsResult.duration;
    const latency = Date.now() - startTime;
    this.isSpeakingState = false;

    // 6. Record Observability Telemetry
    const telemetry: VoiceTelemetry = {
      id: `telemetry-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sessionId,
      audioId: ttsResult.audioId,
      text: finalSpokenText,
      voiceLatencyMs: latency,
      ttsGenerationMs: ttsGenTimeMs,
      ttsDurationMs: totalDuration,
      avatarStartLatencyMs: Math.max(0, avatarStart - startTime),
      avatarDurationMs,
      answerDurationMs: totalDuration,
      status: isVoiceDegraded ? 'DEGRADED' : 'SUCCESS',
      provider: ttsProvider.providerName,
      isSimulated: ttsResult.metadata.isSimulated !== false,
      timestamp: new Date().toISOString()
    };
    db.voiceTelemetries.unshift(telemetry);

    return {
      audioId: ttsResult.audioId,
      spokenText: finalSpokenText,
      guardrailStatus,
      durationMs: totalDuration,
      voiceLatencyMs: latency,
      ttsGenerationMs: ttsGenTimeMs,
      avatarDurationMs,
      status: isVoiceDegraded ? 'DEGRADED' : 'PLAYED',
      provider: ttsProvider.providerName,
      isSimulated: telemetry.isSimulated
    };
  }

  /**
   * Interrupts current speech immediately, cuts TTS audio, resets avatar, and preserves resume context.
   */
  public async interrupt(reason: string = 'CUSTOMER_INTERRUPTION'): Promise<SpeechResumeContext | null> {
    if (!this.isSpeakingState && hostStateMachineService.getState() !== 'SPEAKING') {
      return null;
    }

    const ttsProvider = ttsProviderFactory.getProvider();
    const avatarProvider = avatarProviderFactory.getProvider();

    // 1. Immediately cut audio and visual speech
    await ttsProvider.stop();
    await avatarProvider.interrupt();

    this.isSpeakingState = false;
    const audioId = this.currentAudioId;
    this.currentAudioId = null;

    // 2. Calculate progress and save SpeechResumeContext
    const elapsedSec = (Date.now() - this.speechStartTime) / 1000;
    const resumeContext: SpeechResumeContext = {
      scriptId: 'script-001',
      scriptBlockId: 'sb-5', // Default active block
      productId: db.session.current_sku || 'SKU-001',
      currentState: hostStateMachineService.getState(),
      currentText: this.currentSpokenText,
      spokenProgress: Math.min(1.0, elapsedSec / 15),
      nextBlockId: 'sb-6',
      interruptedAt: new Date().toISOString()
    };

    db.speechResumeContext = resumeContext;

    // 3. Transition state to INTERRUPTED
    hostStateMachineService.transitionTo('INTERRUPTED', `Speech interrupted (${reason}) for audio ${audioId}`);

    eventService.emit('SPEECH_INTERRUPTED', {
      audioId,
      reason,
      resumeContext,
      timestamp: new Date().toISOString()
    });

    return resumeContext;
  }

  /**
   * Stops voice playback cleanly (e.g. on operator takeover or session pause).
   */
  public async stop(): Promise<void> {
    const ttsProvider = ttsProviderFactory.getProvider();
    const avatarProvider = avatarProviderFactory.getProvider();

    await ttsProvider.stop();
    await avatarProvider.stop();

    this.isSpeakingState = false;
    this.currentAudioId = null;
  }
}

export const voiceOrchestrator = new VoiceOrchestrator();
