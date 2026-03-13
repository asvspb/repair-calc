/**
 * ProtectedRoute — компонент для защиты роутов
 * Перенаправляет на страницу входа если пользователь не аутентифицирован
 */

import React, { type ReactNode } from 'react';
import { Calculator } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  // Показываем загрузку пока проверяем токен
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <div className="text-center">
          <Calculator className="w-12 h-12 text-indigo-600 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600">Проверка авторизации...</p>
        </div>
      </div>
    );
  }

  // Если не авторизован — возвращаем null (редирект будет в App.tsx)
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}

/**
 * Хук для проверки авторизации
 * Возвращает флаг isAuthReady когда проверка завершена
 */
export function useAuthReady(): boolean {
  const { isLoading } = useAuth();
  return !isLoading;
}