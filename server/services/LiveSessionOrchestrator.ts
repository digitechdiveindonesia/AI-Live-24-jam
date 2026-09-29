import { db } from '../db';
import { hostStateMachineService, HostState } from './HostStateMachineService';
import { conversationOrchestrator, OrchestrationResult } from './ConversationOrchestrator';
import { voiceOrchestrator, VoicePlaybackResult } from './VoiceOrchestrator';
import { speechScriptService } from './SpeechScriptService';
import { scriptService } from './ScriptService';
import { questionQueue } from './QuestionQueue';
import { eventService } from './EventService';
import { ttsProviderFactory } from './TTSProvider';
import { avatarProviderFactory } from './AvatarProvider';
import { ScriptBlock, QueuedQuestion } from '../db/schema';
import { liveSessionWatchdog } from './LiveSessionWatchdog';
import { liveSessionService } from './LiveSessionService';

export interface AutonomousStepResult {
  stepName: string;
  spokenText: string;
  voiceResult: VoicePlaybackResult;
  nextStepName: string;
}

export class LiveSessionOrchestrator {
  private isProcessingQueue: boolean = false;
  private isLoopRunning: boolean = false;

  /**
   * Executes a single voice-aware autonomous selling step:
   * 1. Get active script block.
   * 2. Resolve dynamic product variables from Product DB.
   * 3. Run Guardrail validation & generate speech through VoiceOrchestrator.
   * 4. Coordinate Avatar synchronization.
   * 5. Advance selling state without restarting INTRO.
   */
  public async executeAutonomousStep(
    sku: string = db.session.current_sku || 'SKU-001',
    options?: { skipDelay?: boolean; forceStep?: string }
  ): Promise<AutonomousStepResult> {
    if (!db.session.is_ai_host_on || db.session.is_mic_takeover || db.session.is_paused) {
      throw new Error('Autonomous selling loop cannot execute: host is paused or under human takeover');
    }

    liveSessionWatchdog.recordSellingProgress();

    // 1. Select active or forced script block
    let activeBlock: ScriptBlock = scriptService.getActiveBlock();
    if (options?.forceStep) {
      const match = db.scriptBlocks.find(b => b.step_name === options.forceStep);
      if (match) activeBlock = match;
    }

    // 2. Map block step to HostState
    const stateMap: Record<string, HostState> = {
      HOOK: 'INTRO',
      PROBLEM: 'INTRO',
      SOLUTION: 'PRODUCT_INTRO',
      DEMO: 'BENEFITS',
      PROMO: 'PROMO',
      CTA: 'CTA'
    };
    const targetState = stateMap[activeBlock.step_name] || 'PROMO';
    hostStateMachineService.transitionTo(targetState, `Autonomous pitch step: ${activeBlock.step_name}`);

    // 3. Resolve dynamic product variables strictly from authoritative Product DB
    const spokenText = speechScriptService.generateSpokenText(activeBlock, sku);

    // 4. Voice & Avatar execution
    const voiceResult = await voiceOrchestrator.speakResponse(spokenText, {
      sessionId: db.session.id,
      sku,
      source: 'AUTONOMOUS_SCRIPT',
      skipDelay: options?.skipDelay
    });

    // 5. Determine next logical step
    const stepOrder = ['HOOK', 'PROBLEM', 'SOLUTION', 'DEMO', 'PROMO', 'CTA'];
    const currentIndex = stepOrder.indexOf(activeBlock.step_name);
    const nextIndex = (currentIndex + 1) % stepOrder.length;
    const nextStepName = stepOrder[nextIndex];

    eventService.emit('AUTONOMOUS_STEP_COMPLETED', {
      stepName: activeBlock.step_name,
      nextStepName,
      audioId: voiceResult.audioId,
      timestamp: new Date().toISOString()
    });

    // Check if any customer questions arrived in the QuestionQueue during speech
    await this.processQuestionQueue(sku, options?.skipDelay);

    return {
      stepName: activeBlock.step_name,
      spokenText,
      voiceResult,
      nextStepName
    };
  }

  /**
   * Processes customer message through full conversation pipeline + Voice & Avatar execution.
   */
  public async handleCustomerInteraction(
    text: string,
    author: string = 'Penonton Live',
    handle: string = '@penonton',
    platform: string = 'TikTok',
    options?: { skipDelay?: boolean; sku?: string }
  ): Promise<OrchestrationResult> {
    if (!liveSessionService.isAcceptingNewCustomers()) {
      throw new Error('Live session is currently not accepting new customer interactions (session is stopping, paused, or shutting down)');
    }

    liveSessionWatchdog.recordHostActivity();
    const sku = options?.sku || db.session.current_sku || 'SKU-001';

    // 1. Run pipeline
    const result = await conversationOrchestrator.handleCustomerMessage(db.session.id, {
      text,
      author,
      handle,
      platform,
      sku,
      skipTtsDelay: options?.skipDelay ?? true
    });

    // 2. If message was interrupted and answered, also deliver through voice orchestrator
    if (result.interruptionAction === 'INTERRUPTED') {
      await voiceOrchestrator.speakResponse(result.generatedResponse, {
        sessionId: db.session.id,
        sku,
        intent: result.detectedIntent,
        priority: result.priority,
        source: 'CUSTOMER_ANSWER',
        skipDelay: options?.skipDelay
      });

      // 3. Deliver transition bridge
      if (result.transitionBridge) {
        await voiceOrchestrator.speakResponse(result.transitionBridge, {
          sessionId: db.session.id,
          sku,
          source: 'CUSTOMER_ANSWER',
          skipDelay: options?.skipDelay
        });
      }

      // 4. Return control to selling loop
      hostStateMachineService.transitionTo('RESUMING', 'Delivered transition bridge');
      const targetStep: HostState = (['PROMO', 'CTA', 'BENEFITS', 'SOLUTION', 'DEMO', 'PRODUCT_INTRO', 'INTRO'].includes(result.resumeStep as any))
        ? (result.resumeStep as HostState)
        : 'PROMO';
      hostStateMachineService.transitionTo(targetStep, `Resumed selling at ${result.resumeStep}`);
    }

    // 5. Drain any pending items in question queue sequentially
    await this.processQuestionQueue(sku, options?.skipDelay);

    return result;
  }

  /**
   * Sequentially drains queued questions one by one to prevent overlapping audio channels.
   */
  public async processQuestionQueue(sku: string = 'SKU-001', skipDelay?: boolean): Promise<number> {
    if (this.isProcessingQueue) return 0;
    this.isProcessingQueue = true;
    let processedCount = 0;

    try {
      while (questionQueue.peek() && !db.session.is_mic_takeover && db.session.is_ai_host_on) {
        const nextQ: QueuedQuestion | undefined = questionQueue.dequeue();
        if (!nextQ) break;

        hostStateMachineService.onCustomerInterruption(nextQ.message);

        const result = await conversationOrchestrator.handleCustomerMessage(db.session.id, {
          text: nextQ.message,
          sku: nextQ.productId || sku,
          skipTtsDelay: skipDelay ?? true
        });

        await voiceOrchestrator.speakResponse(result.generatedResponse, {
          sessionId: db.session.id,
          sku: nextQ.productId || sku,
          intent: nextQ.intent,
          priority: nextQ.priority,
          source: 'CUSTOMER_ANSWER',
          skipDelay
        });

        questionQueue.updateStatus(nextQ.id, 'ANSWERED');
        processedCount++;
      }
    } finally {
      this.isProcessingQueue = false;
    }

    return processedCount;
  }

  // Operator Action Controls
  public async pauseAi(): Promise<void> {
    db.session.is_ai_host_on = false;
    db.session.is_paused = true;
    await voiceOrchestrator.stop();
    hostStateMachineService.pauseHost();
    eventService.emit('OPERATOR_PAUSED_AI', { timestamp: new Date().toISOString() });
  }

  public async resumeAi(): Promise<void> {
    db.session.is_ai_host_on = true;
    db.session.is_paused = false;
    hostStateMachineService.resumeHost();
    eventService.emit('OPERATOR_RESUMED_AI', { timestamp: new Date().toISOString() });
  }

  public async takeoverMic(): Promise<void> {
    db.session.is_mic_takeover = true;
    await voiceOrchestrator.stop();
    hostStateMachineService.takeoverMic();
    eventService.emit('OPERATOR_MIC_TAKEOVER', { timestamp: new Date().toISOString() });
  }

  public async releaseMic(): Promise<void> {
    db.session.is_mic_takeover = false;
    hostStateMachineService.releaseTakeover();
    eventService.emit('OPERATOR_MIC_RELEASED', { timestamp: new Date().toISOString() });
  }
}

export const liveSessionOrchestrator = new LiveSessionOrchestrator();
