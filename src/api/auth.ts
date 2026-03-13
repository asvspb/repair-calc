/**
 * API клиент для аутентификации
 */

import type { 
  User, 
  AuthTokens, 
  LoginCredentials, 
  RegisterCredentials, 
  AuthResponse,
  RefreshResponse 
} from '../types/auth';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3993';

class AuthApiError extends Error {
  public errors?: Array<{ field: string; message: string }>;
  
  constructor(message: string, public statusCode: number, errors?: Array<{ field: string; message: string }>) {
    super(message);
    this.name = 'AuthApiError';
    this.errors = errors;
  }
}

async function fetchJson<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Добавляем токен авторизации если есть
  const token = localStorage.getItem('token');
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new AuthApiError(
      data.message || 'Произошла ошибка',
      response.status,
      data.errors
    );
  }

  return data;
}

/**
 * Регистрация нового пользователя
 */
export async function register(credentials: RegisterCredentials): Promise<AuthResponse> {
  return fetchJson<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
}

/**
 * Вход в систему
 */
export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  return fetchJson<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
}

/**
 * Обновление токенов
 */
export async function refreshToken(refreshToken: string): Promise<RefreshResponse> {
  return fetchJson<RefreshResponse>('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}

/**
 * Получение информации о текущем пользователе
 * Возвращает null при 401 (ожидаемая ситуация для неавторизованных пользователей)
 */
export async function getCurrentUser(): Promise<{ status: string; data: User }> {
  const url = `${API_BASE}/api/auth/me`;

  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const token = localStorage.getItem('token');
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    headers: defaultHeaders,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new AuthApiError(
      data.message || 'Произошла ошибка',
      response.status,
      data.errors
    );
  }

  return data;
}

/**
 * Выход из системы
 */
export async function logout(): Promise<void> {
  await fetchJson('/api/auth/logout', {
    method: 'POST',
  });
}

/**
 * Сохранение токенов в localStorage
 */
export function saveTokens(tokens: AuthTokens): void {
  localStorage.setItem('token', tokens.token);
  localStorage.setItem('refreshToken', tokens.refreshToken);
}

/**
 * Удаление токенов из localStorage
 */
export function clearTokens(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
}

/**
 * Получение токена из localStorage
 */
export function getStoredToken(): string | null {
  return localStorage.getItem('token');
}

/**
 * Получение refresh токена из localStorage
 */
export function getStoredRefreshToken(): string | null {
  return localStorage.getItem('refreshToken');
}

export { AuthApiError };