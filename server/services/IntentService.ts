import { geminiService } from './GeminiService';

export type IntentType =
  | 'PRODUCT_QUESTION'
  | 'PRICE_QUESTION'
  | 'PROMOTION_QUESTION'
  | 'STOCK_QUESTION'
  | 'VARIANT_QUESTION'
  | 'USAGE_QUESTION'
  | 'SHIPPING_QUESTION'
  | 'RETURN_QUESTION'
  | 'GENERAL_QUESTION'
  | 'COMPLAINT'
  | 'ESCALATION'
  | 'UNKNOWN';

export interface IntentAnalysisResult {
  intent: IntentType;
  confidence: number;
  productCandidates: string[];
  requiresProductData: boolean;
  requiresKnowledgeRetrieval: boolean;
  requiresHumanReview: boolean;
  reason: string;
}

export class IntentService {
  public async analyzeIntent(customerMessage: string, currentOnAirSku: string = 'SKU-001'): Promise<IntentAnalysisResult> {
    const rawClassification = await geminiService.classifyIntent(customerMessage);
    const intent = (rawClassification.intent as IntentType) || 'GENERAL_QUESTION';
    const confidence = rawClassification.confidence;

    // Detect candidate products mentioned in text
    const lower = customerMessage.toLowerCase();
    const productCandidates: string[] = [];
    if (lower.includes('serum') || lower.includes('brightening') || lower.includes('booster')) {
      productCandidates.push('SKU-001');
    }
    if (lower.includes('barrier') || lower.includes('cream') || lower.includes('ceramide')) {
      productCandidates.push('SKU-002');
    }
    if (lower.includes('micellar') || lower.includes('cleanser') || lower.includes('makeup')) {
      productCandidates.push('SKU-003');
    }
    if (lower.includes('sunscreen') || lower.includes('uv') || lower.includes('aqua')) {
      productCandidates.push('SKU-004');
    }
    if (productCandidates.length === 0) {
      productCandidates.push(currentOnAirSku);
    }

    const requiresProductData = [
      'PRODUCT_QUESTION',
      'PRICE_QUESTION',
      'PROMOTION_QUESTION',
      'STOCK_QUESTION',
      'VARIANT_QUESTION'
    ].includes(intent);

    const requiresKnowledgeRetrieval = [
      'USAGE_QUESTION',
      'SHIPPING_QUESTION',
      'RETURN_QUESTION',
      'PRODUCT_QUESTION'
    ].includes(intent);

    const requiresHumanReview = [
      'COMPLAINT',
      'ESCALATION'
    ].includes(intent) || confidence < 0.60;

    return {
      intent,
      confidence,
      productCandidates,
      requiresProductData,
      requiresKnowledgeRetrieval,
      requiresHumanReview,
      reason: rawClassification.reason
    };
  }
}

export const intentService = new IntentService();
