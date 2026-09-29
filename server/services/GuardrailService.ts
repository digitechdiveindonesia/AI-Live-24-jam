import { VerifiedProductFacts } from './ProductVerificationService';

export interface GuardrailAuditResult {
  status: 'APPROVED' | 'MODIFIED' | 'BLOCKED';
  sanitizedText: string;
  violationsDetected: string[];
  reason: string;
}

export class GuardrailService {
  private restrictedPatterns: { regex: RegExp; reason: string; fix: string }[] = [
    {
      regex: /putih\s+(instan|permanen|seketika)|memutihkan(?:\s+\w+)?\s+dalam\s+\d+\s+(hari|jam|menit)/gi,
      reason: 'BPOM Violation: Overpromising instantaneous/permanent skin bleaching claims',
      fix: 'mencerahkan kulit tampak bercahaya secara bertahap'
    },
    {
      regex: /sembuh\s+total|pasti\s+sembuh|menghilangkan\s+jerawat\s+100%|mengobati\s+eksim/gi,
      reason: 'BPOM Violation: Unauthorized medical curative claims on cosmetic products',
      fix: 'merawat dan menenangkan kulit berjerawat'
    },
    {
      regex: /harga\s+gratis|bayar\s+0\s+rupiah/gi,
      reason: 'Commercial Fraud Risk: False pricing claims',
      fix: 'harga spesial diskon live'
    }
  ];

  public auditResponse(candidateResponse: string, verifiedFacts?: VerifiedProductFacts | null): GuardrailAuditResult {
    let sanitizedText = candidateResponse;
    const violationsDetected: string[] = [];

    // Check against prohibited patterns
    for (const rule of this.restrictedPatterns) {
      if (rule.regex.test(sanitizedText)) {
        violationsDetected.push(rule.reason);
        sanitizedText = sanitizedText.replace(rule.regex, rule.fix);
      }
    }

    // Verify pricing grounding if verified facts provided
    if (verifiedFacts) {
      // Check if candidate invented a conflicting price
      const priceNumbers = candidateResponse.match(/Rp\s?([0-9.]+)/gi);
      if (priceNumbers) {
        // Ensure price is grounded
        const validPriceStrings = [
          verifiedFacts.salePrice.toString(),
          verifiedFacts.basePrice.toString(),
          verifiedFacts.salePriceFormatted.replace(/[^\d]/g, ''),
          verifiedFacts.basePriceFormatted.replace(/[^\d]/g, '')
        ];
        for (const found of priceNumbers) {
          const rawNum = found.replace(/[^\d]/g, '');
          if (rawNum.length >= 4 && !validPriceStrings.some(v => v.includes(rawNum))) {
            violationsDetected.push(`Price discrepancy detected: ${found} does not match verified price ${verifiedFacts.salePriceFormatted}`);
            sanitizedText = sanitizedText.replace(found, verifiedFacts.salePriceFormatted);
          }
        }
      }
    }

    if (violationsDetected.length === 0) {
      return {
        status: 'APPROVED',
        sanitizedText,
        violationsDetected: [],
        reason: 'Passed all BPOM compliance, brand policies, and pricing consistency checks.'
      };
    }

    return {
      status: 'MODIFIED',
      sanitizedText,
      violationsDetected,
      reason: `Sanitized ${violationsDetected.length} policy violations to uphold BPOM compliance.`
    };
  }
}

export const guardrailService = new GuardrailService();
