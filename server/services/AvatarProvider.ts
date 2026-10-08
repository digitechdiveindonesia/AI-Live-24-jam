import { db } from '../db';
import { eventService } from './EventService';
import { TTSResult } from './TTSProvider';
import { AvatarStatus, AvatarSession } from '../db/schema';

export interface AvatarSpeakResult {
  durationMs: number;
  status: AvatarStatus;
  avatarId: string;
  audioId: string;
}

export interface AvatarProvider {
  readonly providerName: string;
  initialize(sessionConfig?: Partial<AvatarSession>): Promise<AvatarSession>;
  speak(audio: TTSResult, options?: { skipDelay?: boolean }): Promise<AvatarSpeakResult>;
  interrupt(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): AvatarStatus;
  getSession(): AvatarSession | null;
}

/**
 * MockAvatarProvider:
 * Production-ready mock avatar simulation for local dev and cloud builds.
 * Explicitly simulated: Synchronizes state transitions, lip-sync latency, and playback events
 * without claiming to render actual neural talking-head video.
 */
export class MockAvatarProvider implements AvatarProvider {
  public readonly providerName = 'MOCK';
  private status: AvatarStatus = 'OFFLINE';
  private session: AvatarSession | null = null;
  private currentAudioId: string | null = null;

  constructor() {
    this.session = db.avatarSession;
    if (this.session) {
      this.status = this.session.state;
    }
  }

  public getStatus(): AvatarStatus {
    return this.status;
  }

  public getSession(): AvatarSession | null {
    return this.session;
  }

  public async initialize(sessionConfig?: Partial<AvatarSession>): Promise<AvatarSession> {
    eventService.emit('AVATAR_INITIALIZING', {
      provider: this.providerName,
      sessionId: sessionConfig?.sessionId || db.session.id,
      timestamp: new Date().toISOString()
    });

    const session: AvatarSession = {
      sessionId: sessionConfig?.sessionId || db.session.id || 'LIVE-001',
      provider: this.providerName,
      avatarId: sessionConfig?.avatarId || 'avatar-sari-01',
      voiceId: sessionConfig?.voiceId || 'id-ID-SariLiveNeural',
      state: 'READY',
      currentAudioId: null,
      startedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      metadata: {
        isSimulated: true,
        lipSyncEngine: 'Viseme-Simulation-v1',
        videoResolution: '1080p-simulated',
        ...sessionConfig?.metadata
      }
    };

    this.session = session;
    this.status = 'READY';
    db.avatarSession = session;

    eventService.emit('AVATAR_READY', {
      sessionId: session.sessionId,
      avatarId: session.avatarId,
      provider: this.providerName,
      timestamp: new Date().toISOString()
    });

    return session;
  }

  public async speak(audio: TTSResult, options?: { skipDelay?: boolean }): Promise<AvatarSpeakResult> {
    if (!this.session) {
      await this.initialize();
    }

    this.currentAudioId = audio.audioId;
    this.status = 'SPEAKING';
    if (this.session) {
      this.session.state = 'SPEAKING';
      this.session.currentAudioId = audio.audioId;
      this.session.lastActivityAt = new Date().toISOString();
    }

    // Avatar Started
    eventService.emit('AVATAR_STARTED', {
      sessionId: this.session?.sessionId,
      avatarId: this.session?.avatarId,
      audioId: audio.audioId,
      provider: this.providerName,
      timestamp: new Date().toISOString()
    });

    // Avatar Speaking with viseme metadata
    eventService.emit('AVATAR_SPEAKING', {
      sessionId: this.session?.sessionId,
      avatarId: this.session?.avatarId,
      audioId: audio.audioId,
      durationMs: audio.duration,
      provider: this.providerName,
      timestamp: new Date().toISOString()
    });

    if (options?.skipDelay) {
      this.status = 'READY';
      if (this.session) {
        this.session.state = 'READY';
        this.session.currentAudioId = null;
      }
      eventService.emit('AVATAR_COMPLETED', {
        sessionId: this.session?.sessionId,
        avatarId: this.session?.avatarId,
        audioId: audio.audioId,
        provider: this.providerName,
        timestamp: new Date().toISOString()
      });
      return {
        durationMs: audio.duration,
        status: 'READY',
        avatarId: this.session?.avatarId || 'avatar-sari-01',
        audioId: audio.audioId
      };
    }

    // Simulated speech delay
    const durationToWait = Math.min(audio.duration, 1000);
    await new Promise(resolve => setTimeout(resolve, durationToWait));

    if (this.status === 'SPEAKING' && this.currentAudioId === audio.audioId) {
      this.status = 'READY';
      if (this.session) {
        this.session.state = 'READY';
        this.session.currentAudioId = null;
      }
      eventService.emit('AVATAR_COMPLETED', {
        sessionId: this.session?.sessionId,
        avatarId: this.session?.avatarId,
        audioId: audio.audioId,
        provider: this.providerName,
        timestamp: new Date().toISOString()
      });
    }

    return {
      durationMs: audio.duration,
      status: this.status,
      avatarId: this.session?.avatarId || 'avatar-sari-01',
      audioId: audio.audioId
    };
  }

  public async interrupt(): Promise<void> {
    if (this.status === 'SPEAKING') {
      const prevAudio = this.currentAudioId;
      this.status = 'INTERRUPTED';
      this.currentAudioId = null;
      if (this.session) {
        this.session.state = 'INTERRUPTED';
        this.session.currentAudioId = null;
        this.session.lastActivityAt = new Date().toISOString();
      }

      eventService.emit('AVATAR_INTERRUPTED', {
        sessionId: this.session?.sessionId,
        avatarId: this.session?.avatarId,
        audioId: prevAudio,
        provider: this.providerName,
        timestamp: new Date().toISOString()
      });

      // Rapidly return avatar to READY listening posture
      this.status = 'READY';
      if (this.session) this.session.state = 'READY';
    }
  }

  public async pause(): Promise<void> {
    if (this.status === 'SPEAKING') {
      this.status = 'PAUSED';
      if (this.session) {
        this.session.state = 'PAUSED';
        this.session.lastActivityAt = new Date().toISOString();
      }
      eventService.emit('AVATAR_PAUSED', {
        sessionId: this.session?.sessionId,
        avatarId: this.session?.avatarId,
        provider: this.providerName,
        timestamp: new Date().toISOString()
      });
    }
  }

  public async resume(): Promise<void> {
    if (this.status === 'PAUSED') {
      this.status = 'SPEAKING';
      if (this.session) {
        this.session.state = 'SPEAKING';
        this.session.lastActivityAt = new Date().toISOString();
      }
      eventService.emit('AVATAR_RESUMED', {
        sessionId: this.session?.sessionId,
        avatarId: this.session?.avatarId,
        provider: this.providerName,
        timestamp: new Date().toISOString()
      });
    }
  }

  public async stop(): Promise<void> {
    this.status = 'STOPPED';
    this.currentAudioId = null;
    if (this.session) {
      this.session.state = 'STOPPED';
      this.session.currentAudioId = null;
      this.session.lastActivityAt = new Date().toISOString();
    }
    eventService.emit('AVATAR_STOPPED', {
      sessionId: this.session?.sessionId,
      avatarId: this.session?.avatarId,
      provider: this.providerName,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * ExternalAvatarAdapter:
 * Clean adapter interface for future 3rd-party live avatar streaming providers (HeyGen, D-ID, SadTalker, Tavus).
 */
export class ExternalAvatarAdapter implements AvatarProvider {
  public readonly providerName = 'EXTERNAL';
  private fallback = new MockAvatarProvider();

  public async initialize(sessionConfig?: Partial<AvatarSession>): Promise<AvatarSession> {
    const session = await this.fallback.initialize(sessionConfig);
    session.provider = this.providerName;
    return session;
  }

  public async speak(audio: TTSResult, options?: { skipDelay?: boolean }): Promise<AvatarSpeakResult> {
    return this.fallback.speak(audio, options);
  }

  public async interrupt(): Promise<void> {
    return this.fallback.interrupt();
  }

  public async pause(): Promise<void> {
    return this.fallback.pause();
  }

  public async resume(): Promise<void> {
    return this.fallback.resume();
  }

  public async stop(): Promise<void> {
    return this.fallback.stop();
  }

  public getStatus(): AvatarStatus {
    return this.fallback.getStatus();
  }

  public getSession(): AvatarSession | null {
    return this.fallback.getSession();
  }
}

/**
 * AvatarProviderFactory:
 * Allows configuration-driven avatar provider switching.
 */
export class AvatarProviderFactory {
  private static instance: AvatarProviderFactory;
  private currentMode: 'MOCK' | 'EXTERNAL' = (process.env.AVATAR_PROVIDER as any) || 'MOCK';
  private providers: Map<string, AvatarProvider> = new Map();

  private constructor() {
    this.providers.set('MOCK', new MockAvatarProvider());
    this.providers.set('EXTERNAL', new ExternalAvatarAdapter());
  }

  public static getInstance(): AvatarProviderFactory {
    if (!AvatarProviderFactory.instance) {
      AvatarProviderFactory.instance = new AvatarProviderFactory();
    }
    return AvatarProviderFactory.instance;
  }

  public getProvider(mode?: 'MOCK' | 'EXTERNAL'): AvatarProvider {
    // FREE_ONLY_MODE is the safety switch: external paid avatar providers are never selected by default.
    const freeOnly = process.env.FREE_ONLY_MODE !== 'false';
    const target = freeOnly ? 'MOCK' : (mode || this.currentMode);
    const provider = this.providers.get(target);
    if (!provider) {
      return this.providers.get('MOCK')!;
    }
    return provider;
  }

  public setProvider(mode: 'MOCK' | 'EXTERNAL'): void {
    if (process.env.FREE_ONLY_MODE !== 'false' && mode !== 'MOCK') {
      this.currentMode = 'MOCK';
      eventService.emit('AVATAR_PROVIDER_SWITCHED', { mode: 'MOCK', blockedRequestedMode: mode, reason: 'FREE_ONLY_MODE', timestamp: new Date().toISOString() });
      return;
    }
    this.currentMode = mode;
    eventService.emit('AVATAR_PROVIDER_SWITCHED', {
      mode,
      timestamp: new Date().toISOString()
    });
  }

  public getCurrentProviderMode(): string {
    return this.currentMode;
  }
}

export const avatarProviderFactory = AvatarProviderFactory.getInstance();
