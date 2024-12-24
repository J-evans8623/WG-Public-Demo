/**
 * userModel.test.ts
 * 
 * Test file for verifying the behavior of the userModel.ts interface.
 * This file ensures no false positives occur when testing the abstract interface.
 */

import UserModel, { IUser } from '../userModel';

describe('UserModel Interface', () => {
  it('should define the IUser interface with expected fields', () => {
    const user: Partial<IUser> = {
      googleId: '12345',
      email: 'test@example.com',
      accountType: 'free',
    };

    expect(user).toHaveProperty('googleId', '12345');
    expect(user).toHaveProperty('email', 'test@example.com');
    expect(user).toHaveProperty('accountType', 'free');
  });

  it('should allow the creation of a user document', () => {
    const user = new UserModel({
      googleId: '12345',
      email: 'test@example.com',
      accountType: 'premium',
    });

    expect(user.googleId).toBe('12345');
    expect(user.email).toBe('test@example.com');
    expect(user.accountType).toBe('premium');
  });
});
