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
   * Perform HTTP request
   */
  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const method = options.method || 'GET';
    const url = `${this.config.baseURL}${endpoint}`;
    const startTime = logApiRequest(
      method,
      endpoint,
      options.body ? JSON.parse(options.body as string) : undefined
    );

    // Apply request interceptors
    let enrichedOptions = options;
    for (const interceptor of this.config.requestInterceptors) {
      enrichedOptions = await interceptor(url, enrichedOptions);
    }

    // Default headers
    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Add auth token
    const token = localStorage.getItem('token');
    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
      logDebug('HTTPClient', 'Токен авторизации добавлен в заголовки');
    } else {
      logDebug('HTTPClient', 'Токен авторизации отсутствует');
    }

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
    } catch (error) {
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
    } finally {
      clearTimeout(timeoutId);
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

// Default response interceptor: handle 401 for token refresh
// Note: 401 handling is done in error handler to allow retry
httpClient.addResponseInterceptor(async (response, data) => {
  // Just pass through - error handling happens in catch block
  return data;
});

// Default error handler: attempt token refresh on 401
httpClient.addErrorHandler(async (error, url, method) => {
  if (error instanceof ApiError && error.statusCode === 401) {
    // Don't try to refresh on the refresh endpoint itself
    if (url.includes('/api/auth/refresh')) {
      return;
    }

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
        localStorage.setItem('token', refreshData.token);
        localStorage.setItem('refreshToken', refreshData.refreshToken);
        logDebug('HTTPClient', 'Токен успешно обновлён');
        // Note: The calling code should retry the request if needed
      } else {
        // Refresh failed, clear tokens
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        logDebug('HTTPClient', 'Не удалось обновить токен, выход из системы');
      }
    } catch (refreshError) {
      logDebug('HTTPClient', 'Ошибка при обновлении токена', refreshError);
    }
  }
});

export default httpClient;
