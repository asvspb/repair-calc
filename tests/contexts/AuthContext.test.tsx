/**
 * Тесты для AuthContext - проверка сброса кэша при логине/выходе
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { AuthProvider, useAuth } from '../../src/contexts/AuthContext';
import { ApiStorageProvider } from '../../src/api/storage/apiStorageProvider';
import * as authApi from '../../src/api/auth';

// Mock auth API
vi.mock('../../src/api/auth', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  getCurrentUser: vi.fn(),
  refreshToken: vi.fn(),
  getStoredToken: vi.fn(() => null),
  getStoredRefreshToken: vi.fn(() => null),
  saveTokens: vi.fn(),
  clearTokens: vi.fn(),
  AuthApiError: class AuthApiError extends Error {
    constructor(message: string, public statusCode: number) {
      super(message);
      this.name = 'AuthApiError';
    }
  },
}));

// Mock ApiStorageProvider
vi.mock('../../src/api/storage/apiStorageProvider', () => ({
  ApiStorageProvider: {
    resetInstance: vi.fn(),
    getInstance: vi.fn(() => ({
      clearCache: vi.fn(),
      loadProjectsAsync: vi.fn(),
    })),
  },
}));

// Test component to access auth context
function TestComponent() {
  const { user, isAuthenticated, login, logout } = useAuth();

  return (
    <div>
      <div data-testid="auth-status">{isAuthenticated ? 'authenticated' : 'not-authenticated'}</div>
      <div data-testid="user-name">{user?.name || 'no-user'}</div>
      <button
        data-testid="login-btn"
        onClick={() => login({ email: 'test@test.com', password: 'password123' })}
      >
        Login
      </button>
      <button data-testid="logout-btn" onClick={() => logout()}>
        Logout
      </button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (authApi.getStoredToken as any).mockReturnValue(null);
    (authApi.getStoredRefreshToken as any).mockReturnValue(null);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should reset ApiStorageProvider cache on login', async () => {
    (authApi.login as any).mockResolvedValueOnce({
      data: {
        id: 'user-1',
        email: 'test@test.com',
        name: 'Test User',
        token: 'test-token',
        refreshToken: 'test-refresh-token',
      },
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    fireEvent.click(screen.getByTestId('login-btn'));

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith({
        email: 'test@test.com',
        password: 'password123',
      });
    });

    await waitFor(() => {
      expect(ApiStorageProvider.resetInstance).toHaveBeenCalled();
    });
  });

  it('should reset ApiStorageProvider cache on logout', async () => {
    // Setup authenticated state
    (authApi.getStoredToken as any).mockReturnValue('existing-token');
    (authApi.getStoredRefreshToken as any).mockReturnValue('existing-refresh-token');
    (authApi.getCurrentUser as any).mockResolvedValueOnce({
      data: { id: 'user-1', email: 'test@test.com', name: 'Test User' },
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Wait for initial auth check
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    });

    (authApi.logout as any).mockResolvedValueOnce(undefined);

    fireEvent.click(screen.getByTestId('logout-btn'));

    await waitFor(() => {
      expect(ApiStorageProvider.resetInstance).toHaveBeenCalled();
    });
  });

  it('should show user name after successful login', async () => {
    (authApi.login as any).mockResolvedValueOnce({
      data: {
        id: 'user-1',
        email: 'test@test.com',
        name: 'John Doe',
        token: 'test-token',
        refreshToken: 'test-refresh-token',
      },
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    fireEvent.click(screen.getByTestId('login-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('user-name')).toHaveTextContent('John Doe');
    });

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    });
  });
});