/**
 * AuthContext — контекст аутентификации
 * Управляет состоянием пользователя, токенами и операциями входа/выхода
 */

import React, { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import type { User, AuthState, LoginCredentials, RegisterCredentials } from '../types/auth';
import * as authApi from '../api/auth';
import { StorageManager } from '../utils/storage';

/**
 * Преобразование ошибок валидации в понятные сообщения
 */
function formatValidationErrors(errors: Array<{ field: string; message: string }>): string {
  const fieldNames: Record<string, string> = {
    'email': 'Email',
    'password': 'Пароль',
    'name': 'Имя',
  };

  const messages: Record<string, string> = {
    'Invalid email address': 'Некорректный формат email',
    'Password must be at least 8 characters': 'Пароль должен содержать минимум 8 символов',
    'Must contain uppercase letter': 'Пароль должен содержать заглавную букву (A-Z)',
    'Must contain lowercase letter': 'Пароль должен содержать строчную букву (a-z)',
    'Must contain number': 'Пароль должен содержать цифру (0-9)',
  };

  const formatted = errors.map(err => {
    const fieldName = fieldNames[err.field] || err.field;
    const message = messages[err.message] || err.message;
    return `${fieldName}: ${message}`;
  });

  return formatted.join('. ');
}

interface AuthContextValue extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true, // Начинаем с загрузки для проверки токена
    error: null,
  });

  /**
   * Проверка токена при загрузке приложения
   */
  useEffect(() => {
    const checkAuth = async () => {
      const token = authApi.getStoredToken();
      const refreshToken = authApi.getStoredRefreshToken();

      if (!token || !refreshToken) {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      try {
        // Пробуем получить информацию о пользователе
        const response = await authApi.getCurrentUser();
        setState({
          user: response.data,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        // Если токен истёк, пробуем обновить
        try {
          const refreshResponse = await authApi.refreshToken(refreshToken);
          authApi.saveTokens(refreshResponse.data);
          
          const userResponse = await authApi.getCurrentUser();
          setState({
            user: userResponse.data,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch {
          // При любой ошибке очищаем токены
          authApi.clearTokens();
          setState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      }
    };

    checkAuth();
  }, []);

  /**
   * Вход в систему
   */
  const login = useCallback(async (credentials: LoginCredentials) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await authApi.login(credentials);
      
      authApi.saveTokens({
        token: response.data.token,
        refreshToken: response.data.refreshToken,
      });

      setState({
        user: {
          id: response.data.id,
          email: response.data.email,
          name: response.data.name,
        },
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const message = error instanceof authApi.AuthApiError 
        ? error.message 
        : 'Ошибка входа в систему';
      
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: message,
      });
      throw error;
    }
  }, []);

  /**
   * Регистрация
   */
  const register = useCallback(async (credentials: RegisterCredentials) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await authApi.register(credentials);
      
      authApi.saveTokens({
        token: response.data.token,
        refreshToken: response.data.refreshToken,
      });

      // Очищаем данные предыдущего пользователя при регистрации нового
      StorageManager.clearAll();
      
      setState({
        user: {
          id: response.data.id,
          email: response.data.email,
          name: response.data.name,
        },
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      
      // Перезагружаем страницу для сброса состояния ProjectContext
      window.location.reload();
    } catch (error) {
      let message = 'Ошибка регистрации';
      
      if (error instanceof authApi.AuthApiError) {
        if (error.errors && error.errors.length > 0) {
          message = formatValidationErrors(error.errors);
        } else {
          message = error.message;
        }
      }
      
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: message,
      });
      throw error;
    }
  }, []);

  /**
   * Выход из системы
   */
  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Игнорируем ошибки при выходе
    } finally {
      // Очищаем токены и данные пользователя
      authApi.clearTokens();
      StorageManager.clearAll();
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  }, []);

  /**
   * Очистка ошибки
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const value: AuthContextValue = {
    ...state,
    login,
    register,
    logout,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Хук для доступа к контексту аутентификации
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export { AuthContext };