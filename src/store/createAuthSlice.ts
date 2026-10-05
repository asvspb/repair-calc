import type { StateCreator } from 'zustand';
import type { AuthSlice, StoreState } from './types';
import type {
  LoginCredentials,
  RegisterCredentials,
  User,
} from '../features/auth/model/auth.types';
import * as authApi from '../features/auth/api/auth';
import { StorageManager } from '../utils/storage';
import { ApiStorageProvider } from '../api/storage/apiStorageProvider';

/**
 * Преобразование ошибок валидации в понятные сообщения
 */
function formatValidationErrors(errors: Array<{ field: string; message: string }>): string {
  const fieldNames: Record<string, string> = {
    email: 'Email',
    password: 'Пароль',
    name: 'Имя',
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

/**
 * Проверка токена при загрузке приложения (перенесено из контекста аутентификации)
 */
async function checkAuth(set: (partial: Partial<AuthSlice>) => void): Promise<void> {
  const token = authApi.getStoredToken();
  const refreshToken = authApi.getStoredRefreshToken();

  if (!token || !refreshToken) {
    set({ authIsLoading: false });
    return;
  }

  let userData: User | null = null;
  let shouldRefresh = false;

  // Пробуем получить информацию о пользователе
  try {
    const response = await authApi.getCurrentUser();
    userData = response.data;
  } catch (error) {
    // 401 означает что токен истёк - пробуем обновить
    if (error instanceof authApi.AuthApiError && error.statusCode === 401) {
      shouldRefresh = true;
    } else {
      // Другие ошибки - просто очищаем токены
      authApi.clearTokens();
      set({
        user: null,
        isAuthenticated: false,
        authIsLoading: false,
        authError: null,
      });
      return;
    }
  }

  if (shouldRefresh) {
    // Пробуем обновить токен
    try {
      const refreshResponse = await authApi.refreshToken(refreshToken);
      authApi.saveTokens(refreshResponse.data);

      const userResponse = await authApi.getCurrentUser();
      userData = userResponse.data;
    } catch {
      // При любой ошибке очищаем токены
      authApi.clearTokens();
      set({
        user: null,
        isAuthenticated: false,
        authIsLoading: false,
        authError: null,
      });
      return;
    }
  }

  if (userData) {
    set({
      user: userData,
      isAuthenticated: true,
      authIsLoading: false,
      authError: null,
    });
  }
}

export const createAuthSlice: StateCreator<StoreState, [], [], AuthSlice> = set => ({
  user: null,
  isAuthenticated: false,
  authIsLoading: true, // Начинаем с загрузки для проверки токена
  authError: null,

  setIsAuthenticated: (value: boolean) => {
    set({ isAuthenticated: value });
  },

  initAuthCheck: () => checkAuth(set),

  login: async (credentials: LoginCredentials) => {
    set({ authIsLoading: true, authError: null });

    try {
      const response = await authApi.login(credentials);

      authApi.saveTokens({
        token: response.data.token,
        refreshToken: response.data.refreshToken,
      });

      // Сбрасываем кэш ApiStorageProvider для загрузки данных нового пользователя
      ApiStorageProvider.resetInstance();

      set({
        user: {
          id: response.data.id,
          email: response.data.email,
          name: response.data.name,
        },
        isAuthenticated: true,
        authIsLoading: false,
        authError: null,
      });
    } catch (error) {
      const message =
        error instanceof authApi.AuthApiError ? error.message : 'Ошибка входа в систему';

      set({
        user: null,
        isAuthenticated: false,
        authIsLoading: false,
        authError: message,
      });
      throw error;
    }
  },

  register: async (credentials: RegisterCredentials) => {
    set({ authIsLoading: true, authError: null });

    try {
      const response = await authApi.register(credentials);

      authApi.saveTokens({
        token: response.data.token,
        refreshToken: response.data.refreshToken,
      });

      // Очищаем данные предыдущего пользователя при регистрации нового
      StorageManager.clearAll();

      set({
        user: {
          id: response.data.id,
          email: response.data.email,
          name: response.data.name,
        },
        isAuthenticated: true,
        authIsLoading: false,
        authError: null,
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

      set({
        user: null,
        isAuthenticated: false,
        authIsLoading: false,
        authError: message,
      });
      throw error;
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // Игнорируем ошибки при выходе
    } finally {
      // Очищаем токены (но НЕ очищаем данные проектов - они сохранены на сервере)
      authApi.clearTokens();
      // Сбрасываем кэш ApiStorageProvider
      ApiStorageProvider.resetInstance();
      set({
        user: null,
        isAuthenticated: false,
        authIsLoading: false,
        authError: null,
      });
    }
  },

  clearAuthError: () => {
    set({ authError: null });
  },
});
