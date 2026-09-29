import { eventService } from './EventService';
import { MessagePriority } from '../db/schema';

export interface TTSPlaybackResult {
  audioDurationMs: number;
  played: boolean;
  voiceText: string;
}

export class TTSAdapter {
  private activeSpeaking: boolean = false;
  private currentSpeechId: string | null = null;
  private defaultVoice: string = 'id-ID-SariLiveNeural';

  public isSpeaking(): boolean {
    return this.activeSpeaking;
  }

  public getCurrentSpeechId(): string | null {
    return this.currentSpeechId;
  }

  /**
   * Synthesize audio from Indonesian text and simulate live voice stream playback.
   * Calculates realistic speech duration (average conversational Indonesian rate ~160 words/min = ~375ms/word).
   */
  public async synthesizeAndPlay(
    text: string,
    options?: { voiceId?: string; priority?: MessagePriority; skipDelay?: boolean }
  ): Promise<TTSPlaybackResult> {
    const speechId = `tts-${Date.now()}`;
    this.currentSpeechId = speechId;
    this.activeSpeaking = true;

    const wordCount = text.trim().split(/\s+/).length;
    // ~150-180 words per minute => ~350-400ms per word
    const calculatedDuration = Math.max(800, Math.min(6000, wordCount * 360));

    eventService.emit('TTS_SPEECH_STARTED', {
      speechId,
      voice: options?.voiceId || this.defaultVoice,
      durationMs: calculatedDuration,
      text
    });

    if (options?.skipDelay) {
      this.activeSpeaking = false;
      this.currentSpeechId = null;
      eventService.emit('TTS_SPEECH_COMPLETED', { speechId, text });
      return {
        audioDurationMs: calculatedDuration,
        played: true,
        voiceText: text
      };
    }

    // In non-test or async streaming mode, simulate audio completion
    await new Promise(resolve => setTimeout(resolve, Math.min(calculatedDuration, 1200)));

    if (this.currentSpeechId === speechId) {
      this.activeSpeaking = false;
      this.currentSpeechId = null;
      eventService.emit('TTS_SPEECH_COMPLETED', { speechId, text });
    }

    return {
      audioDurationMs: calculatedDuration,
      played: true,
      voiceText: text
    };
  }

  public stopSpeech(): void {
    if (this.activeSpeaking) {
      const speechId = this.currentSpeechId;
      this.activeSpeaking = false;
      this.currentSpeechId = null;
      eventService.emit('TTS_SPEECH_INTERRUPTED', { speechId });
    }
  }
}

export const ttsAdapter = new TTSAdapter();
