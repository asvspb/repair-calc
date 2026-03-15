/**
 * Totals API - сохранение и загрузка рассчитанных данных проекта
 */

export interface TotalsData {
  total_area: number;
  total_works: number;
  total_materials: number;
  total_tools: number;
  grand_total: number;
}

export interface TotalsResponse {
  project_id: string;
  total_area: number | null;
  total_works: number | null;
  total_materials: number | null;
  total_tools: number | null;
  grand_total: number | null;
  calculated_at: string;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3993';

export class TotalsApiError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = 'TotalsApiError';
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
    throw new TotalsApiError(
      data.message || 'Произошла ошибка',
      response.status
    );
  }

  return data;
}

/**
 * Сохранить рассчитанные итоги проекта
 */
export async function saveTotals(
  projectId: string,
  totals: TotalsData
): Promise<TotalsResponse> {
  const response = await fetchJson<{ status: string; data: TotalsResponse }>(`/api/totals/${projectId}`, {
    method: 'POST',
    body: JSON.stringify(totals),
  });
  return response.data;
}

/**
 * Загрузить рассчитанные итоги проекта
 */
export async function getTotals(projectId: string): Promise<TotalsResponse | null> {
  try {
    const response = await fetchJson<{ status: string; data: TotalsResponse | null }>(
      `/api/totals/${projectId}`
    );
    return response.data;
  } catch {
    return null;
  }
}
