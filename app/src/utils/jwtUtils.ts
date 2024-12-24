/**
 * jwtUtils.ts
 * 
 * Utility functions for generating and verifying JSON Web Tokens.
 */

import jwt from 'jsonwebtoken';

/**
 * JwtUtils
 * 
 * Provides methods to generate and verify JSON Web Tokens.
 */
class JwtUtils {
  private secret: string = process.env.JWT_SECRET || 'default_secret';

  /**
   * Generates a JWT for a given payload.
   * 
   * @param payload - The data to encode within the JWT.
   * @returns - A signed JWT.
   */
  public generateJWT(payload: object): string {
    return jwt.sign(payload, this.secret, { expiresIn: '1h' });
  }

  /**
   * Verifies a given JWT.
   * 
   * @param token - The JWT to verify.
   * @returns - The decoded payload if valid.
   */
  public verifyJWT(token: string): object | string {
    return jwt.verify(token, this.secret);
  }
}

export default new JwtUtils();
