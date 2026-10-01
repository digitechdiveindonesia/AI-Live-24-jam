import { GoogleGenAI } from '@google/genai';

export interface GeminiIntentClassification {
  intent: string;
  confidence: number;
  reason: string;
}

export interface GeminiProductCandidate {
  sku: string;
  confidence: number;
  extractedKeywords: string[];
}

export interface GeminiStructuredResponse {
  response: string;
  intent: string;
  productId: string;
  tone: string;
  requiresHumanReview: boolean;
  shouldContinueSelling: boolean;
}

export class GeminiService {
  private client: GoogleGenAI | null = null;
  private modelName = 'gemini-3.8-flash';

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        this.client = new GoogleGenAI({ apiKey });
      } catch (err) {
        console.warn('[GeminiService] Failed to initialize client, fallback mode enabled:', err);
      }
    }
  }

  public async classifyIntent(userMessage: string): Promise<GeminiIntentClassification> {
    if (process.env.NODE_ENV !== 'test' && this.client) {
      try {
        const timeoutMs = 2500;
        const timeoutPromise = new Promise<never>((_, reject) => {
          const timer = setTimeout(() => reject(new Error('Gemini API timeout')), timeoutMs);
          timer.unref?.();
        });

        const callPromise = this.client.models.generateContent({
          model: this.modelName,
          contents: `Classify the intent of this live stream customer chat message: "${userMessage}".
Allowed intents: PRODUCT_QUESTION, PRICE_QUESTION, PROMOTION_QUESTION, STOCK_QUESTION, VARIANT_QUESTION, USAGE_QUESTION, SHIPPING_QUESTION, RETURN_QUESTION, GENERAL_QUESTION, COMPLAINT, ESCALATION, UNKNOWN.
Return strict JSON with fields: {"intent": string, "confidence": number, "reason": string}.`,
        });

        const response: any = await Promise.race([callPromise, timeoutPromise]);
        const text = response.text || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            intent: parsed.intent || 'UNKNOWN',
            confidence: Number(parsed.confidence) || 0.85,
            reason: parsed.reason || 'Classified by Gemini'
          };
        }
      } catch (err) {
        console.warn('[GeminiService] classifyIntent error, fallback used:', (err as any)?.message || err);
      }
    }

    // High precision deterministic NLP fallback
    const lower = userMessage.toLowerCase();
    if (lower.includes('harga') || lower.includes('berapa') || lower.includes('rp') || lower.includes('diskon') || lower.includes('promo') || lower.includes('potongan')) {
      return { intent: lower.includes('promo') ? 'PROMOTION_QUESTION' : 'PRICE_QUESTION', confidence: 0.95, reason: 'Keyword matched price/promo patterns' };
    }
    if (lower.includes('stok') || lower.includes('ready') || lower.includes('ada gak') || lower.includes('sisa')) {
      return { intent: 'STOCK_QUESTION', confidence: 0.92, reason: 'Keyword matched stock inquiry' };
    }
    if (lower.includes('cara pakai') || lower.includes('sensitif') || lower.includes('bumil') || lower.includes('kandungan') || lower.includes('tekstur')) {
      return { intent: 'USAGE_QUESTION', confidence: 0.94, reason: 'Keyword matched usage/clinical inquiry' };
    }
    if (lower.includes('kirim') || lower.includes('cod') || lower.includes('ongkir') || lower.includes('sampai')) {
      return { intent: 'SHIPPING_QUESTION', confidence: 0.96, reason: 'Keyword matched logistics inquiry' };
    }
    if (lower.includes('retur') || lower.includes('pecah') || lower.includes('rusak') || lower.includes('garansi') || lower.includes('belum sampai') || lower.includes('komplain')) {
      return { intent: lower.includes('retur') ? 'RETURN_QUESTION' : 'COMPLAINT', confidence: 0.93, reason: 'Keyword matched complaints/returns inquiry' };
    }

    return { intent: 'GENERAL_QUESTION', confidence: 0.80, reason: 'Default conversational match' };
  }

  /**
   * Generates structured response contract strictly adhering to Phase 2B rules:
   * - Bahasa Indonesia
   * - Natural, concise, conversational, suitable for live commerce
   * - Easy for TTS (no markdown, no bullets)
   * - Grounded in verified Product DB data
   */
  public async generateStructuredResponse(
    customerQuery: string,
    verifiedFacts: {
      sku: string;
      name: string;
      price: string;
      normalPrice?: string;
      stock: number;
      promo: string;
      usage: string;
      shipping: string;
    },
    rules: string[],
    contextSummary?: string
  ): Promise<GeminiStructuredResponse> {
    if (process.env.NODE_ENV !== 'test' && this.client) {
      try {
        const timeoutMs = 2500;
        const timeoutPromise = new Promise<never>((_, reject) => {
          const timer = setTimeout(() => reject(new Error('Gemini API timeout')), timeoutMs);
          timer.unref?.();
        });

        const prompt = `You are Sari, an energetic Indonesian AI live commerce host.
Authoritative facts (MUST NOT BE CONTRADICTED):
- Product: ${verifiedFacts.name} (${verifiedFacts.sku})
- Sale Price: ${verifiedFacts.price}
- Normal Price: ${verifiedFacts.normalPrice || 'Rp99.000'}
- Stock: ${verifiedFacts.stock} units
- Active Promo: ${verifiedFacts.promo}
- Benefits: ${verifiedFacts.usage}
- Logistics & COD: ${verifiedFacts.shipping}

Guardrail Rules:
${rules.join('\n')}

Short-term Chat Context:
${contextSummary || 'Tidak ada riwayat sebelumnya'}

Customer asks: "${customerQuery}"

Strict Output Requirements:
1. Spoken Bahasa Indonesia for live streaming.
2. Short, punchy, conversational (under 35 words).
3. NO markdown (NO bold, NO asterisks, NO bullets).
4. Direct answer with verified facts + smooth call to action to click keranjang kuning.
5. Return JSON ONLY with schema:
{
  "response": string,
  "intent": string,
  "productId": string,
  "tone": "friendly" | "enthusiastic" | "empathetic",
  "requiresHumanReview": boolean,
  "shouldContinueSelling": boolean
}`;

        const callPromise = this.client.models.generateContent({
          model: this.modelName,
          contents: prompt
        });

        const res: any = await Promise.race([callPromise, timeoutPromise]);
        const text = res.text || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            response: (parsed.response || '').replace(/[\*\_#`]/g, '').trim(),
            intent: parsed.intent || 'GENERAL_QUESTION',
            productId: parsed.productId || verifiedFacts.sku,
            tone: parsed.tone || 'friendly',
            requiresHumanReview: Boolean(parsed.requiresHumanReview),
            shouldContinueSelling: parsed.shouldContinueSelling !== false
          };
        }
      } catch (err) {
        console.warn('[GeminiService] generateStructuredResponse error, fallback used:', (err as any)?.message || err);
      }
    }

    // High quality deterministic fallback strictly adhering to verified facts & Indonesian live streaming rules
    return this.getDeterministicFallback(customerQuery, verifiedFacts);
  }

  public async generateResponse(
    customerQuery: string,
    verifiedFacts: { sku: string; name: string; price: string; stock: number; promo: string; usage: string; shipping: string },
    rules: string[]
  ): Promise<string> {
    const structured = await this.generateStructuredResponse(customerQuery, verifiedFacts, rules);
    return structured.response;
  }

  private getDeterministicFallback(
    customerQuery: string,
    verifiedFacts: { sku: string; name: string; price: string; normalPrice?: string; stock: number; promo: string; usage: string; shipping: string }
  ): GeminiStructuredResponse {
    const lower = customerQuery.toLowerCase();
    const normalPrice = verifiedFacts.normalPrice || 'Rp99.000';

    if (lower.includes('harga') || lower.includes('berapa') || lower.includes('promo') || lower.includes('diskon')) {
      return {
        response: `${verifiedFacts.name} sekarang lagi promo jadi ${verifiedFacts.price} dari harga normal ${normalPrice}. Yuk langsung amankan di keranjang kuning kak!`,
        intent: 'PRICE_QUESTION',
        productId: verifiedFacts.sku,
        tone: 'enthusiastic',
        requiresHumanReview: false,
        shouldContinueSelling: true
      };
    }

    if (lower.includes('stok') || lower.includes('ready') || lower.includes('sisa')) {
      return {
        response: `Stok ${verifiedFacts.name} ready kak, tapi tersisa ${verifiedFacts.stock} botol lagi khusus live ini. Buruan checkout sebelum kehabisan ya!`,
        intent: 'STOCK_QUESTION',
        productId: verifiedFacts.sku,
        tone: 'friendly',
        requiresHumanReview: false,
        shouldContinueSelling: true
      };
    }

    if (lower.includes('sensitif') || lower.includes('bumil') || lower.includes('pakai') || lower.includes('jerawat')) {
      const hasClinicalEvidence = verifiedFacts.usage && (
        verifiedFacts.usage.toLowerCase().includes('dermatologis') ||
        verifiedFacts.usage.toLowerCase().includes('bpom') ||
        verifiedFacts.usage.toLowerCase().includes('sensitif') ||
        verifiedFacts.usage.toLowerCase().includes('niacinamide') ||
        verifiedFacts.usage.toLowerCase().includes('kulit')
      );

      if (hasClinicalEvidence) {
        return {
          response: `Untuk ${verifiedFacts.name}, ${verifiedFacts.usage}. Informasi terverifikasi resmi ya kak. Yuk amankan selagi promo!`,
          intent: 'USAGE_QUESTION',
          productId: verifiedFacts.sku,
          tone: 'friendly',
          requiresHumanReview: false,
          shouldContinueSelling: true
        };
      } else {
        return {
          response: `Mohon maaf kak, untuk informasi kecocokan spesifik ${verifiedFacts.name}, data klinis resmi belum tercantum di sistem kami. Disarankan konsultasi dokter ya kak.`,
          intent: 'USAGE_QUESTION',
          productId: verifiedFacts.sku,
          tone: 'friendly',
          requiresHumanReview: false,
          shouldContinueSelling: false
        };
      }
    }

    if (lower.includes('cod') || lower.includes('kirim') || lower.includes('ongkir')) {
      const shippingInfo = verifiedFacts.shipping?.trim();
      if (shippingInfo && shippingInfo.length > 0) {
        return {
          response: `${shippingInfo} untuk ${verifiedFacts.name}. Silakan cek ketersediaan kurir di keranjang kuning ya kak!`,
          intent: 'SHIPPING_QUESTION',
          productId: verifiedFacts.sku,
          tone: 'friendly',
          requiresHumanReview: false,
          shouldContinueSelling: true
        };
      } else {
        return {
          response: `Informasi opsi pengiriman untuk ${verifiedFacts.name} dapat dicek langsung saat memilih kurir di keranjang kuning ya kak.`,
          intent: 'SHIPPING_QUESTION',
          productId: verifiedFacts.sku,
          tone: 'friendly',
          requiresHumanReview: false,
          shouldContinueSelling: true
        };
      }
    }

    if (lower.includes('sampai') || lower.includes('rusak') || lower.includes('belum') || lower.includes('komplain')) {
      return {
        response: `Mohon maaf atas ketidaknyamanannya kak. Tim customer service kami segera bantu cek nomor pesanannya lewat DM sekarang juga ya kak.`,
        intent: 'COMPLAINT',
        productId: verifiedFacts.sku,
        tone: 'empathetic',
        requiresHumanReview: true,
        shouldContinueSelling: false
      };
    }

    return {
      response: `Betul kak! Untuk ${verifiedFacts.name} lagi ada promo ${verifiedFacts.promo} dengan stok tersisa ${verifiedFacts.stock} pcs. Yuk amankan di keranjang kuning!`,
      intent: 'GENERAL_QUESTION',
      productId: verifiedFacts.sku,
      tone: 'friendly',
      requiresHumanReview: false,
      shouldContinueSelling: true
    };
  }
}

export const geminiService = new GeminiService();
