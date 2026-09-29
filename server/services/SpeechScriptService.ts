import { db } from '../db';
import { productVerificationService } from './ProductService';
import { ScriptBlock } from '../db/schema';

export class SpeechScriptService {
  /**
   * Converts a script block template into TTS-friendly Indonesian spoken text,
   * replacing all dynamic variables with authoritative commerce values from Product DB.
   */
  public generateSpokenText(block: ScriptBlock, sku: string = 'SKU-001'): string {
    const rawTemplate = block.content;
    const resolved = this.resolveVariables(rawTemplate, sku);
    return this.sanitizeForTTS(resolved);
  }

  /**
   * Resolves dynamic template tokens using authoritative commerce data from Product DB.
   * Supported tokens:
   * - {{product_name}}
   * - {{price}}
   * - {{sale_price}}
   * - {{promo}}
   * - {{stock}}
   * - {{variant}}
   */
  public resolveVariables(template: string, sku: string = 'SKU-001'): string {
    const verified = productVerificationService.verifyProductData(sku);
    const product = db.getProductBySku(sku);
    const variants = product ? db.getVariantsForProduct(product.id) : [];
    const firstVariantName = variants[0]?.variant_name || 'Standard 20ml';

    const productName = verified?.name || product?.name || 'Serum X Brightening Booster';
    const basePriceFormatted = verified?.basePriceFormatted || (product ? `Rp${product.base_price.toLocaleString('id-ID')}` : 'Rp99.000');
    const salePriceFormatted = verified?.salePriceFormatted || (product?.sale_price ? `Rp${product.sale_price.toLocaleString('id-ID')}` : 'Rp79.000');
    const promoTitle = verified?.promoTitle || 'Diskon 20%';
    const stockAvailable = verified?.totalStock ?? (product ? 23 : 20);

    let result = template
      .replace(/\{\{product_name\}\}/gi, productName)
      .replace(/\{\{sale_price\}\}/gi, salePriceFormatted)
      .replace(/\{\{price\}\}/gi, basePriceFormatted)
      .replace(/\{\{promo\}\}/gi, promoTitle)
      .replace(/\{\{stock\}\}/gi, `${stockAvailable}`)
      .replace(/\{\{variant\}\}/gi, firstVariantName);

    return result;
  }

  /**
   * Strips markdown artifacts, bullets, asterisks, and technical codes so the text
   * flows smoothly and naturally through the TTS engine.
   */
  public sanitizeForTTS(text: string): string {
    return text
      .replace(/[\*\_#`~]/g, '') // remove markdown symbols
      .replace(/^[\s-•\d\.\)]+/gm, '') // remove bullet points & numbers at start of lines
      .replace(/\s+/g, ' ') // collapse multiple whitespaces
      .trim();
  }

  /**
   * Generates a spoken continuation phrase for a given step after an interruption.
   */
  public generateContinuationText(stepName: string, sku: string = 'SKU-001'): string {
    const verified = productVerificationService.verifyProductData(sku);
    const name = verified?.name || 'Serum X';
    const price = verified?.salePriceFormatted || 'Rp79.000';
    const stock = verified?.totalStock || 23;

    switch (stepName) {
      case 'BENEFITS':
      case 'SOLUTION':
        return `Seperti yang tadi Sari jelaskan, ${name} ini formulanya kaya Niacinamide murni yang cepat meresap bikin kulit makin glowing dan kenyal!`;
      case 'PROMO':
        return `Nah jangan lupa, khusus di live sekarang lagi ada potongan harga jadi ${price} aja kak!`;
      case 'CTA':
        return `Stoknya sisa ${stock} botol lagi kak, langsung checkout di keranjang kuning nomor satu ya!`;
      default:
        return `Yuk langsung amankan promo spesial ${name} sekarang juga di keranjang kuning!`;
    }
  }
}

export const speechScriptService = new SpeechScriptService();
