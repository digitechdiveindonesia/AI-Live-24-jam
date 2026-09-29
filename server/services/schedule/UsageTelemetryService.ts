import { UsageTelemetry } from '../../db/schema';
import { db } from '../../db';

export class UsageTelemetryService {
  private static instance: UsageTelemetryService;

  private constructor() {}

  public static getInstance(): UsageTelemetryService {
    if (!UsageTelemetryService.instance) {
      UsageTelemetryService.instance = new UsageTelemetryService();
    }
    return UsageTelemetryService.instance;
  }

  public getUsage(): UsageTelemetry {
    return { ...db.usageTelemetry };
  }

  public recordRuntimeStart(): void {
    db.recordUsage({
      runtimeStartCount: (db.usageTelemetry.runtimeStartCount || 0) + 1
    });
  }

  public recordRuntimeDuration(seconds: number): void {
    db.recordUsage({
      runtimeDurationSec: seconds,
      sessionDurationSec: seconds
    });
  }

  public recordApiCall(type: 'GEMINI' | 'TTS' | 'PLATFORM' | 'GENERIC'): void {
    if (type === 'GEMINI') {
      db.recordUsage({ geminiRequests: 1, apiCalls: 1 });
    } else if (type === 'TTS') {
      db.recordUsage({ ttsRequests: 1, apiCalls: 1 });
    } else if (type === 'PLATFORM') {
      db.recordUsage({ platformRequests: 1, apiCalls: 1 });
    } else {
      db.recordUsage({ apiCalls: 1 });
    }
  }

  public resetUsage(): void {
    db.usageTelemetry = {
      runtimeStartCount: 0,
      runtimeDurationSec: 0,
      sessionDurationSec: 0,
      estimatedComputeHours: 0,
      apiCalls: 0,
      geminiRequests: 0,
      ttsRequests: 0,
      platformRequests: 0,
      isSimulated: true,
      billingStatus: 'USAGE_DATA_AVAILABLE'
    };
  }
}

export const usageTelemetryService = UsageTelemetryService.getInstance();
