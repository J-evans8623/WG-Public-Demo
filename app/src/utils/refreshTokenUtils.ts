import crypto from 'crypto';
import UserModel from '../models/userModel';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY as string;
if (!ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY environment variable is required');

const IV_LENGTH = 16;
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

export class RefreshTokenUtils {
  private static encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(16);
    const key = crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, 100000, 32, 'sha512');
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    
    return `${iv.toString('hex')}:${salt.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  private static decrypt(encryptedText: string): string {
    const [ivHex, saltHex, authTagHex, encrypted] = encryptedText.split(':');
    
    const iv = Buffer.from(ivHex, 'hex');
    const salt = Buffer.from(saltHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, 100000, 32, 'sha512');
    
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  static async saveRefreshToken(userId: string, refreshToken: string): Promise<void> {
    try {
      const encryptedToken = this.encrypt(refreshToken);
      await UserModel.findByIdAndUpdate(
        userId,
        { refreshToken: encryptedToken },
        { new: true, upsert: true }
      );
    } catch (error) {
      console.error('Error saving refresh token:', error);
      throw error;
    }
  }

  static async getRefreshToken(userId: string): Promise<string | null> {
    try {
      const user = await UserModel.findById(userId);
      if (!user?.refreshToken) return null;
      return this.decrypt(user.refreshToken);
    } catch (error) {
      console.error('Error retrieving refresh token:', error);
      throw error;
    }
  }

  static async revokeRefreshToken(userId: string): Promise<void> {
    try {
      await UserModel.findByIdAndUpdate(userId, { $unset: { refreshToken: 1 } });
    } catch (error) {
      console.error('Error revoking refresh token:', error);
      throw error;
    }
  }
}