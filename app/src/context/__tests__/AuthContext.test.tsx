/**
 * AuthContext.test.ts
 *
 * Tests for AuthContext.ts abstract interface.
 */
import React from 'react';
import { renderHook, act } from '@testing-library/react-hooks';
import { AuthContext, AuthContextInterface, User, useAuthContext } from '../AuthContext';

// Mock context and provider
const createMockContext = (): AuthContextInterface => ({
  user: null,
  isAuthenticated: false,
  signIn: jest.fn().mockImplementation(async (token: string) => {
    mockContext.isAuthenticated = true;
    mockContext.user = {
      email: 'test@example.com',
      accountType: 'premium',
      accessToken: token,
    };
  }),
  signOut: jest.fn().mockImplementation(() => {
    mockContext.isAuthenticated = false;
    mockContext.user = null;
  }),
  refreshToken: jest.fn().mockResolvedValue(undefined),
});

let mockContext: AuthContextInterface;
const MockAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <AuthContext.Provider value={mockContext}>{children}</AuthContext.Provider>;
};

beforeEach(() => {
  mockContext = createMockContext(); // Reset context before each test
});

describe('AuthContext Interface', () => {  

  it('should have an initial state of unauthenticated', () => {
    const { result } = renderHook(() => useAuthContext(), {
      wrapper: MockAuthProvider,
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('should update state on successful sign-in', async () => {
    const { result } = renderHook(() => useAuthContext(), {
      wrapper: MockAuthProvider,
    });

    const token = 'mock_access_token';
    await act(async () => {
      await result.current.signIn(token);
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual({
      email: 'test@example.com',
      accountType: 'premium',
      accessToken: token,
    });
  });

  it('should reset state on sign-out', async () => {
    const { result } = renderHook(() => useAuthContext(), {
      wrapper: MockAuthProvider,
    });

    await act(() => {
      result.current.signOut();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('should handle token refresh correctly', async () => {
    const { result } = renderHook(() => useAuthContext(), {
      wrapper: MockAuthProvider,
    });

    await act(async () => {
      await result.current.refreshToken();
    });

    expect(result.current.refreshToken).toHaveBeenCalled();
  });
});
