import { db } from '../db';
import { scriptService } from './ScriptService';
import { hostStateMachineService, HostState } from './HostStateMachineService';
import { ttsAdapter } from './TTSAdapter';
import { questionQueue } from './QuestionQueue';
import { eventService } from './EventService';
import { MessagePriority, ScriptBlock } from '../db/schema';

export type InterruptionState =
  | 'SELLING'
  | 'WAITING_FOR_INTERRUPT'
  | 'INTERRUPTING'
  | 'ANSWERING'
  | 'TRANSITIONING'
  | 'RESUMING';

export interface PreservedScriptPosition {
  blockId: string;
  stepName: string;
  content: string;
  sellingState: HostState;
  interruptedSnippet?: string;
  timestamp: string;
}

export interface InterruptionDecision {
  canInterrupt: boolean;
  reason: string;
  action: 'INTERRUPT_NOW' | 'QUEUE' | 'IGNORE';
  preservedPosition?: PreservedScriptPosition;
}

export class InterruptionEngine {
  private engineState: InterruptionState = 'SELLING';
  private preservedPosition: PreservedScriptPosition | null = null;
  private currentActiveSpeakerId: string | null = null;

  constructor() {
    this.syncFromHostState();
  }

  public getState(): InterruptionState {
    return this.engineState;
  }

  public getPreservedPosition(): PreservedScriptPosition | null {
    return this.preservedPosition;
  }

  private syncFromHostState(): void {
    const hostState = hostStateMachineService.getState();
    if (hostState === 'CUSTOMER_INTERRUPTION') {
      this.engineState = 'INTERRUPTING';
    } else if (hostState === 'ANSWERING') {
      this.engineState = 'ANSWERING';
    } else if (hostState === 'TRANSITION') {
      this.engineState = 'TRANSITIONING';
    } else if (hostState === 'RETURN_TO_SELLING') {
      this.engineState = 'RESUMING';
    } else {
      this.engineState = 'SELLING';
    }
  }

  /**
   * Evaluates if incoming customer message can and should interrupt the host right now.
   */
  public evaluateInterruption(
    messageText: string,
    priority: MessagePriority,
    intent: string
  ): InterruptionDecision {
    const hostState = hostStateMachineService.getState();

    // 1. Human takeover or paused: AI cannot interrupt
    if (hostState === 'HUMAN_TAKEOVER' || hostState === 'PAUSED' || !db.session.is_ai_host_on) {
      return {
        canInterrupt: false,
        reason: 'Host is currently under human operator takeover or paused',
        action: 'QUEUE'
      };
    }

    // 2. Already answering another customer: Prevent overlapping audio channels
    if (this.engineState === 'ANSWERING' || this.engineState === 'INTERRUPTING' || ttsAdapter.isSpeaking()) {
      return {
        canInterrupt: false,
        reason: 'Host is actively answering a question. Enqueueing to prevent audio overlap.',
        action: 'QUEUE'
      };
    }

    // 3. Low priority casual comment: Do not interrupt live pitch mid-sentence
    if (priority === 'LOW') {
      return {
        canInterrupt: false,
        reason: 'Casual commentary/greeting (LOW priority). Selling pitch takes precedence.',
        action: 'IGNORE'
      };
    }

    // 4. Host is selling: Normal, High, or Critical questions can safely interrupt
    const activeBlock = scriptService.getActiveBlock();
    const preserved: PreservedScriptPosition = {
      blockId: activeBlock.id,
      stepName: activeBlock.step_name,
      content: activeBlock.content,
      sellingState: hostStateMachineService.getState(),
      interruptedSnippet: activeBlock.content.substring(0, 45),
      timestamp: new Date().toISOString()
    };

    return {
      canInterrupt: true,
      reason: `Eligible for interruption (${priority} priority). Script position saved at ${activeBlock.step_name}.`,
      action: 'INTERRUPT_NOW',
      preservedPosition: preserved
    };
  }

  /**
   * Trigger interruption: safely cuts current speech, preserves script position, and enters INTERRUPTING state.
   */
  public beginInterruption(messageText: string, preservedPosition: PreservedScriptPosition): void {
    this.preservedPosition = preservedPosition;
    ttsAdapter.stopSpeech();

    this.engineState = 'INTERRUPTING';
    hostStateMachineService.onCustomerInterruption(messageText);

    eventService.emit('HOST_INTERRUPTED', {
      state: this.engineState,
      preservedStep: preservedPosition.stepName,
      message: messageText
    });
  }

  /**
   * Host starts speaking the AI answer.
   */
  public startAnswering(answerText: string): void {
    this.engineState = 'ANSWERING';
    hostStateMachineService.onStartAnswering(answerText);
    eventService.emit('HOST_ANSWERING_STARTED', {
      state: this.engineState,
      answerText
    });
  }

  /**
   * Answer finished. Transition back smoothly to selling without restarting INTRO.
   */
  public completeAnswerAndResume(answeredIntent: string, sku: string): { transitionBridge: string; resumeStep: string } {
    this.engineState = 'TRANSITIONING';
    hostStateMachineService.transitionTo('TRANSITION', 'Customer answer completed');

    // Generate seamless transition bridge phrase based on what was answered and where host left off
    const transitionBridge = this.generateTransitionBridge(answeredIntent, this.preservedPosition);

    this.engineState = 'RESUMING';
    hostStateMachineService.transitionTo('RETURN_TO_SELLING', 'Smooth return bridge to active pitch');

    // Restore or advance to appropriate logical selling step
    const resumeStep = this.preservedPosition ? this.preservedPosition.stepName : 'PROMO';
    const targetState: HostState = (['PROMO', 'CTA', 'BENEFITS', 'SOLUTION', 'DEMO'].includes(this.preservedPosition?.sellingState as any))
      ? (this.preservedPosition?.sellingState as HostState)
      : 'PROMO';

    // Transition back to selling
    this.engineState = 'SELLING';
    hostStateMachineService.transitionTo(targetState, `Resumed selling at ${resumeStep}`);

    eventService.emit('RETURN_TO_SELLING', {
      state: this.engineState,
      resumeStep,
      transitionBridge
    });

    return { transitionBridge, resumeStep };
  }

  /**
   * Generates natural Indonesian conversational bridge phrase connecting the answer back to selling.
   */
  public generateTransitionBridge(intent: string, preserved: PreservedScriptPosition | null): string {
    const step = preserved?.stepName || 'PROMO';

    if (intent === 'PRICE_QUESTION' || intent === 'PROMOTION_QUESTION') {
      return `Nah, kalau tadi soal harga dan promonya udah jelas banget ya kak, sekarang balik lagi nih ke keunggulan utamanya...`;
    }
    if (intent === 'STOCK_QUESTION') {
      return `Stoknya beneran terbatas banget kak, jadi sebelum kehabisan yuk langsung checkout sekarang!`;
    }
    if (intent === 'USAGE_QUESTION') {
      return `Cara pakainya praktis banget kan kak? Nah, buat dapetin hasil maksimal jangan lupa manfaatin promo live sekarang ya!`;
    }
    if (intent === 'SHIPPING_QUESTION') {
      return `Pengiriman dijamin aman dan cepat kak! Nah, langsung aja klik keranjang kuning nomor satu ya!`;
    }

    return `Nah, menjawab pertanyaan tadi, yuk kita lanjut lagi ke promo spesial hari ini kak!`;
  }
}

export const interruptionEngine = new InterruptionEngine();
