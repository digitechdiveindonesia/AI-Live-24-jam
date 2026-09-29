import { db } from '../db';

export type HostState =
  | 'IDLE'
  | 'INTRO'
  | 'PRODUCT_INTRO'
  | 'BENEFITS'
  | 'PROMO'
  | 'CTA'
  | 'WAITING'
  | 'CUSTOMER_INTERRUPTION'
  | 'INTERRUPTED'
  | 'SPEECH_PREPARING'
  | 'SPEAKING'
  | 'ANSWERING'
  | 'TRANSITION'
  | 'TRANSITIONING'
  | 'RETURN_TO_SELLING'
  | 'RESUMING'
  | 'PAUSED'
  | 'HUMAN_TAKEOVER'
  | 'ERROR';

export interface HostStateTransition {
  from: HostState;
  to: HostState;
  trigger: string;
  timestamp: string;
}

export class HostStateMachineService {
  private currentState: HostState = 'PROMO';
  private previousSellingState: HostState = 'PROMO';
  private currentSku: string = 'SKU-001';
  private currentScriptStep: number = 4; // PROMO step
  private listeners: ((state: HostState) => void)[] = [];

  constructor() {
    this.currentState = (db.session.active_state as HostState) || 'PROMO';
  }

  public getState(): HostState {
    return this.currentState;
  }

  public getPreviousSellingState(): HostState {
    return this.previousSellingState;
  }

  public getCurrentSku(): string {
    return this.currentSku;
  }

  public subscribe(listener: (state: HostState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.currentState);
    }
  }

  public transitionTo(newState: HostState, trigger: string = 'AUTOMATIC_LOOP'): void {
    const from = this.currentState;
    if (from === newState) return;

    // Track selling state before interruption
    if (['INTRO', 'PRODUCT_INTRO', 'BENEFITS', 'PROMO', 'CTA'].includes(from)) {
      this.previousSellingState = from;
    }

    this.currentState = newState;
    db.session.active_state = newState;
    db.logHostEvent(db.session.id, 'STATE_CHANGE', from, newState, trigger);
    this.notify();
  }

  // Interruption logic: Smooth transition from selling -> customer question -> answer -> return to selling
  public onCustomerInterruption(question: string): void {
    if (this.currentState === 'HUMAN_TAKEOVER' || this.currentState === 'PAUSED') {
      return;
    }
    this.transitionTo('CUSTOMER_INTERRUPTION', `Chat Interruption: "${question.substring(0, 30)}..."`);
  }

  public onStartAnswering(answerText: string): void {
    this.transitionTo('ANSWERING', `Live Host answering: "${answerText.substring(0, 30)}..."`);
  }

  public onFinishedAnswering(immediate: boolean = process.env.NODE_ENV === 'test'): void {
    this.transitionTo('TRANSITION', 'Finished answering customer question');
    if (immediate) {
      this.transitionTo('RETURN_TO_SELLING', 'Smooth return bridge to pitch');
      const returnState = this.previousSellingState === 'PROMO' ? 'CTA' : 'PROMO';
      this.transitionTo(returnState, 'Resuming autonomous selling loop');
      return;
    }
    const t1 = setTimeout(() => {
      this.transitionTo('RETURN_TO_SELLING', 'Smooth return bridge to pitch');
      const t2 = setTimeout(() => {
        // Return to the active pitch step or advance to CTA
        const returnState = this.previousSellingState === 'PROMO' ? 'CTA' : 'PROMO';
        this.transitionTo(returnState, 'Resuming autonomous selling loop');
      }, 1000);
      t2.unref?.();
    }, 800);
    t1.unref?.();
  }

  public pauseHost(): void {
    this.transitionTo('PAUSED', 'Operator paused AI host');
  }

  public resumeHost(): void {
    this.transitionTo(this.previousSellingState || 'PROMO', 'Operator resumed AI host');
  }

  public takeoverMic(): void {
    this.transitionTo('HUMAN_TAKEOVER', 'Human operator mic takeover engaged');
  }

  public releaseTakeover(): void {
    this.transitionTo('RETURN_TO_SELLING', 'Human operator released mic');
    setTimeout(() => {
      this.transitionTo('PROMO', 'AI Host re-engaged');
    }, 1000);
  }

  public reset(initialState: HostState = 'INTRO'): void {
    this.currentState = initialState;
    this.previousSellingState = initialState;
    db.session.active_state = initialState;
    this.notify();
  }
}

export const hostStateMachineService = new HostStateMachineService();
export const hostStateService = hostStateMachineService;
