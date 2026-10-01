import crypto from 'crypto';

/**
 * Server-Side AES-256-GCM Token Encryption Service.
 * Ensures access_token and refresh_token are NEVER stored in plaintext in the database,
 * and NEVER exposed to frontend or external callers.
 */
export class TokenEncryptionService {
  private static instance: TokenEncryptionService;
  private encryptionKey: Buffer;

  private constructor() {
    const rawKey =
      process.env.PLATFORM_TOKEN_ENCRYPTION_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.DATABASE_KEY ||
      'indonesia_live_commerce_platform_vault_secret_key_32b';

    // Derive a fixed 32-byte (256-bit) key using SHA-256
    this.encryptionKey = crypto.createHash('sha256').update(rawKey).digest();
  }

  public static getInstance(): TokenEncryptionService {
    if (!TokenEncryptionService.instance) {
      TokenEncryptionService.instance = new TokenEncryptionService();
    }
    return TokenEncryptionService.instance;
  }

  /**
   * Encrypts a sensitive platform token into iv:authTag:cipherText (base64).
   */
  public encryptToken(plainText: string): string {
    if (!plainText) return '';
    try {
      const iv = crypto.randomBytes(12); // standard 96-bit IV for AES-GCM
      const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
      let encrypted = cipher.update(plainText, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      const authTag = cipher.getAuthTag();

      return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
    } catch {
      throw new Error('TOKEN_ENCRYPTION_FAILED');
    }
  }

  /**
   * Decrypts an encrypted platform token string.
   */
  public decryptToken(encryptedString: string): string {
    if (!encryptedString) return '';
    try {
      const parts = encryptedString.split(':');
      if (parts.length !== 3) {
        // Fallback for mock/plaintext strings if legacy format
        return encryptedString;
      }

      const iv = Buffer.from(parts[0], 'base64');
      const authTag = Buffer.from(parts[1], 'base64');
      const cipherText = parts[2];

      const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(cipherText, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch {
      throw new Error('TOKEN_DECRYPTION_FAILED');
    }
  }
}

export const tokenEncryptionService = TokenEncryptionService.getInstance();
