/**
 * Unified HTTP client with interceptors
 * Provides consistent error handling, authentication, and retry logic
 */

import {
  logApiRequest,
  logApiSuccess,
  logApiError,
  logDebug,
} from '../utils/logger';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3993';
const DEFAULT_TIMEOUT = 30000; // 30 seconds

/**
 * Token refresh state management
 * Prevents concurrent refresh attempts and queues pending requests
 */
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

/**
 * API Error class
 */
export class ApiError extends Error {
  constructor(
    public message: string,
    public statusCode: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Request interceptor type
 */
export type RequestInterceptor = (
  url: string,
  options: RequestInit
) => RequestInit | Promise<RequestInit>;

/**
 * Response interceptor type
 */
export type ResponseInterceptor = <T>(
  response: Response,
  data: T
) => T | Promise<T>;

/**
 * Error handler type
 */
export type ErrorHandler = (
  error: ApiError | Error,
  url: string,
  method: string
) => void | Promise<void>;

/**
 * HTTP Client configuration
 */
interface HttpClientConfig {
  baseURL: string;
  timeout: number;
  requestInterceptors: RequestInterceptor[];
  responseInterceptors: ResponseInterceptor[];
  errorHandlers: ErrorHandler[];
}

/**
 * Perform token refresh with mutex lock
 * Returns true if refresh succeeded, false otherwise
 */
async function performTokenRefresh(): Promise<boolean> {
  // If already refreshing, wait for the existing refresh to complete
  if (isRefreshing && refreshPromise) {
    logDebug('HTTPClient', 'Ожидание завершения обновления токена');
    return refreshPromise;
  }

  // Start refresh process
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      logDebug('HTTPClient', 'Попытка обновления токена');
      const refreshResponse = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken: localStorage.getItem('refreshToken'),
        }),
      });

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        // Сервер возвращает { status: 'success', data: { token, refreshToken } }
        const tokens = refreshData.data || refreshData;
        if (tokens.token && tokens.refreshToken) {
          localStorage.setItem('token', tokens.token);
          localStorage.setItem('refreshToken', tokens.refreshToken);
          logDebug('HTTPClient', 'Токен успешно обновлён');
          return true;
        } else {
          logDebug('HTTPClient', 'Некорректный ответ сервера при обновлении токена');
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          return false;
        }
      } else {
        // Refresh failed, clear tokens
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        logDebug('HTTPClient', 'Не удалось обновить токен, выход из системы');
        return false;
      }
    } catch (refreshError) {
      logDebug('HTTPClient', 'Ошибка при обновлении токена', refreshError);
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Unified HTTP Client with interceptors
 */
class HttpClient {
  private config: HttpClientConfig = {
    baseURL: API_BASE,
    timeout: DEFAULT_TIMEOUT,
    requestInterceptors: [],
    responseInterceptors: [],
    errorHandlers: [],
  };

  private static instance: HttpClient | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): HttpClient {
    if (!HttpClient.instance) {
      HttpClient.instance = new HttpClient();
    }
    return HttpClient.instance;
  }

  /**
   * Reset instance (useful for tests or reconfiguration)
   */
  static resetInstance(): void {
    HttpClient.instance = null;
    // Also reset refresh state
    isRefreshing = false;
    refreshPromise = null;
  }

  /**
   * Add request interceptor
   */
  addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.config.requestInterceptors.push(interceptor);
  }

  /**
   * Add response interceptor
   */
  addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.config.responseInterceptors.push(interceptor);
  }

  /**
   * Add error handler
   */
  addErrorHandler(handler: ErrorHandler): void {
    this.config.errorHandlers.push(handler);
  }

  /**
   * Update configuration
   */
  configure(config: Partial<HttpClientConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Internal method to perform the actual fetch without retry logic
   */
  private async fetchWithTimeout<T>(
    url: string,
    options: RequestInit,
    startTime: number,
    method: string,
    endpoint: string
  ): Promise<T> {
    // Apply request interceptors
    let enrichedOptions = options;
    for (const interceptor of this.config.requestInterceptors) {
      enrichedOptions = await interceptor(url, enrichedOptions);
    }

    // Default headers
    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.config.timeout
    );

    try {
      const response = await fetch(url, {
        ...enrichedOptions,
        headers: {
          ...defaultHeaders,
          ...enrichedOptions.headers,
        },
        signal: controller.signal,
      });

      let data = await response.json();

      // Apply response interceptors
      for (const interceptor of this.config.responseInterceptors) {
        data = await interceptor(response, data);
      }

      if (!response.ok) {
        throw new ApiError(data.message || 'API error', response.status, data);
      }

      logApiSuccess(method, endpoint, startTime, data);
      return data as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Perform HTTP request with automatic token refresh and retry
   */
  async request<T>(
    endpoint: string,
    options: RequestInit = {},
    isRetry: boolean = false
  ): Promise<T> {
    const method = options.method || 'GET';
    const url = `${this.config.baseURL}${endpoint}`;
    const startTime = logApiRequest(
      method,
      endpoint,
      options.body ? JSON.parse(options.body as string) : undefined
    );

    try {
      return await this.fetchWithTimeout<T>(url, options, startTime, method, endpoint);
    } catch (error) {
      // Handle 401 with token refresh and retry
      if (error instanceof ApiError && error.statusCode === 401 && !isRetry) {
        // Don't try to refresh on the refresh endpoint itself
        if (!url.includes('/api/auth/refresh')) {
          const refreshSucceeded = await performTokenRefresh();
          
          if (refreshSucceeded) {
            // Retry the original request with new token
            logDebug('HTTPClient', 'Повторный запрос с новым токеном');
            try {
              return await this.fetchWithTimeout<T>(url, options, startTime, method, endpoint);
            } catch (retryError) {
              // If retry also fails, throw the error
              throw retryError;
            }
          }
        }
      }

      // Handle API errors
      if (error instanceof ApiError) {
        for (const handler of this.config.errorHandlers) {
          await handler(error, url, method);
        }
        logApiError(method, endpoint, startTime, {
          status: error.statusCode,
          message: error.message,
        });
        throw error;
      }

      // Handle timeout/abort
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError = new ApiError(
          'Превышено время ожидания запроса',
          408
        );
        logApiError(method, endpoint, startTime, { timeout: true });
        throw timeoutError;
      }

      // Handle other errors
      logApiError(method, endpoint, startTime, error);
      throw error;
    }
  }

  /**
   * HTTP GET
   */
  async get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  /**
   * HTTP POST
   */
  async post<T>(
    endpoint: string,
    data?: unknown,
    options?: RequestInit
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * HTTP PUT
   */
  async put<T>(
    endpoint: string,
    data?: unknown,
    options?: RequestInit
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * HTTP PATCH
   */
  async patch<T>(
    endpoint: string,
    data?: unknown,
    options?: RequestInit
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * HTTP DELETE
   */
  async delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

// Singleton instance
export const httpClient = HttpClient.getInstance();

// Default request interceptor: add auth token
httpClient.addRequestInterceptor((url, options) => {
  const token = localStorage.getItem('token');
  if (token) {
    return {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    };
  }
  return options;
});

// Default response interceptor: pass through
// Note: 401 handling is done in request method with retry logic
httpClient.addResponseInterceptor(async (response, data) => {
  return data;
});

// No default error handler - token refresh with retry is handled in request method
// Error handlers can still be added by calling code for custom error handling

export default httpClient;
