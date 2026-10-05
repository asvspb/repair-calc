import { useProjectStore } from './useProjectStore';
import type { LoginCredentials, RegisterCredentials } from '../features/auth/model/auth.types';

/**
 * Публичный хук аутентификации (бывш. useAuth контекста аутентификации).
 * Тонкая проекция zustand-слоя createAuthSlice на прежний контракт:
 * состояние + login/register/logout/clearError.
 * Живёт на инфраструктурном слое store, чтобы фичи могли его использовать
 * без прямых cross-feature импортов в features/auth (см. depcruise fsd-auth).
 */
export function useAuth() {
  const user = useProjectStore(s => s.user);
  const isAuthenticated = useProjectStore(s => s.isAuthenticated);
  const isLoading = useProjectStore(s => s.authIsLoading);
  const error = useProjectStore(s => s.authError);
  const login = useProjectStore(s => s.login);
  const register = useProjectStore(s => s.register);
  const logout = useProjectStore(s => s.logout);
  const clearError = useProjectStore(s => s.clearAuthError);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login: (credentials: LoginCredentials) => login(credentials),
    register: (credentials: RegisterCredentials) => register(credentials),
    logout: () => logout(),
    clearError,
  };
}
