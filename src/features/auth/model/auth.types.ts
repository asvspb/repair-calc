/**
 * Типы для аутентификации на клиенте
 */

export interface User {
  id: string;
  email: string;
  name: string | null;
}

export interface AuthTokens {
  token: string;
  refreshToken: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  name?: string;
}

export interface AuthResponse {
  status: 'success' | 'error';
  data: User & AuthTokens;
  message?: string;
}

export interface RefreshResponse {
  status: 'success' | 'error';
  data: AuthTokens;
}

export interface AuthContextValue extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}
