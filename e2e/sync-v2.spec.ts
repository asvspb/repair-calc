import { test, expect } from '@playwright/test';

/**
 * E2E SYNC-V2 (batch г; спека devAI/spec/SPEC-SYNC-V2.md §5(г), дополнения ТЗ):
 * минимальный сценарий «мутация → flush → повторный init без потерь» под
 * VITE_SYNC_V2=true. Запускается только в V2-режиме:
 *   VITE_SYNC_V2=true pnpm exec playwright test e2e/sync-v2.spec.ts --project=chromium
 * Базовый набор (без флага) — остальными спеками в старом режиме.
 *
 * Бэкенд мокируется на уровне маршрутов (стратегия e2e/fixtures.ts): состояние
 * «сервера» — мутируемый массив; push применяет изменения к нему, повторный pull
 * возвращает их — потеря данных видна в UI после reload.
 */

// В базовом режиме (без флага) спека пропускается — базовый набор зелёный без неё
test.skip(
  process.env.VITE_SYNC_V2 !== 'true',
  'SYNC-V2 e2e запускается только с VITE_SYNC_V2=true',
);

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const OBJECT_ID = '33333333-1111-4111-8111-111111111111';
const ROOM_ID = '22222222-1111-4111-8111-111111111111';

interface FakeServerRoom {
  id: string;
  object_id: string;
  name: string;
  geometry_mode: 'simple';
  length: number;
  width: number;
  height: number;
  segments: null;
  obstacles: null;
  wall_sections: null;
  sub_sections: null;
  windows: null;
  doors: null;
  works: null;
  created_at: string;
  updated_at: string;
}

interface FakeServerProject {
  id: string;
  name: string;
  city: null;
  use_ai_pricing: false;
  version: number;
  updated_at: string;
  objects: Array<{
    id: string;
    project_id: string;
    name: string;
    city: null;
    sort_order: number;
    version: number;
    updated_at: string;
    rooms: FakeServerRoom[];
  }>;
}

function makeFakeServer(): FakeServerProject[] {
  const now = new Date().toISOString();
  return [
    {
      id: PROJECT_ID,
      name: 'E2E V2 Проект',
      city: null,
      use_ai_pricing: false,
      version: 1,
      updated_at: now,
      objects: [
        {
          id: OBJECT_ID,
          project_id: PROJECT_ID,
          name: 'Объект 1',
          city: null,
          sort_order: 0,
          version: 1,
          updated_at: now,
          rooms: [
            {
              id: ROOM_ID,
              object_id: OBJECT_ID,
              name: 'Комната 1',
              geometry_mode: 'simple',
              length: 5,
              width: 4,
              height: 2.7,
              segments: null,
              obstacles: null,
              wall_sections: null,
              sub_sections: null,
              windows: null,
              doors: null,
              works: null,
              created_at: now,
              updated_at: now,
            },
          ],
        },
      ],
    },
  ];
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

/** JSON-ответ с CORS (API_BASE = VITE_API_URL — кросс-доменно к vite-серверу теста) */
async function fulfillJson(route: import('@playwright/test').Route, body: unknown): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  });
}

test.describe('SYNC-V2 жизненный цикл (мутация → flush → повторный init)', () => {
  test('мутация комнаты уходит пушем, после reload данные на месте', async ({ page }) => {
    const fakeServer = makeFakeServer();
    const pushes: Array<Record<string, unknown>> = [];

    await page.addInitScript(() => {
      localStorage.setItem('token', 'e2e-token');
      localStorage.setItem('refreshToken', 'e2e-refresh');
      localStorage.setItem('e2e-test-mode', 'true');
    });

    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      if (!url.pathname.startsWith('/api/')) {
        await route.continue();
        return;
      }

      // CORS-префлайт (Authorization/JSON content-type) — отвечаем разрешением
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: CORS_HEADERS });
        return;
      }

      if (url.pathname.startsWith('/api/auth/me')) {
        await fulfillJson(route, {
          data: { id: 'e2e-user', email: 'e2e@test.dev', name: 'E2E' },
        });
        return;
      }

      if (url.pathname.startsWith('/api/sync/pull')) {
        await fulfillJson(route, {
          status: 'success',
          data: {
            projects: JSON.parse(JSON.stringify(fakeServer)),
            timestamp: Date.now(),
          },
        });
        return;
      }

      if (url.pathname.startsWith('/api/sync/push')) {
        const body = route.request().postDataJSON() as {
          changes: Array<{
            id: string;
            entity: string;
            entityId: string;
            data: Record<string, unknown>;
          }>;
        };
        pushes.push(body as unknown as Record<string, unknown>);

        // «Сервер» применяет изменения (LWW-принимающая сторона)
        const now = new Date().toISOString();
        for (const change of body.changes) {
          if (change.entity === 'room') {
            for (const project of fakeServer) {
              for (const obj of project.objects) {
                for (const room of obj.rooms) {
                  if (room.id === change.entityId) {
                    room.length = Number(change.data.length ?? room.length);
                    room.width = Number(change.data.width ?? room.width);
                    room.height = Number(change.data.height ?? room.height);
                    room.updated_at = now;
                  }
                }
              }
            }
          } else if (change.entity === 'project') {
            for (const project of fakeServer) {
              if (project.id === change.entityId) {
                project.name = String(change.data.name ?? project.name);
                project.updated_at = now;
              }
            }
          }
        }

        await fulfillJson(route, {
          status: 'success',
          data: {
            synced: body.changes.map(c => c.id),
            conflicts: [],
          },
        });
        return;
      }

      // Остальные API (totals и пр.) — пустые успешные ответы
      await fulfillJson(route, { data: [] });
    });

    // 1. Первый init: полный pull (lastSyncAt ещё нет)
    await page.goto('/');
    const roomItem = page.getByTestId(`room-item-${ROOM_ID}`);
    await expect(roomItem).toBeVisible({ timeout: 15000 });

    // 2. Мутация комнаты: длина 5 → 9
    await roomItem.click();
    const lengthInput = page.getByTestId('geom-length');
    await expect(lengthInput).toBeVisible();
    await lengthInput.fill('9');
    await page.getByTestId('room-header-title').click(); // blur → updateRoom

    // 3. Flush по debounce (2 с): POST /api/sync/push с комнатой length=9
    const pushRequest = await page.waitForRequest(
      request => request.url().includes('/api/sync/push') && request.method() === 'POST',
      { timeout: 20000 },
    );
    const pushBody = pushRequest.postDataJSON() as {
      changes: Array<{ entity: string; entityId: string; data: { length?: number } }>;
    };
    const roomChange = pushBody.changes.find(c => c.entity === 'room' && c.entityId === ROOM_ID);
    expect(roomChange).toBeDefined();
    expect(roomChange?.data.length).toBe(9);

    // dirty снята: повторных пушей того же изменения нет
    await page.waitForTimeout(3500);
    expect(pushes).toHaveLength(1);

    // 4. Повторный init (reload): инкрементальный pull (since) → данные без потерь
    const pullRequests: string[] = [];
    page.on('request', request => {
      if (request.url().includes('/api/sync/pull')) {
        pullRequests.push(request.url());
      }
    });
    await page.reload();
    await expect(page.getByTestId(`room-item-${ROOM_ID}`)).toBeVisible({
      timeout: 15000,
    });
    await roomItem.click();
    await expect(page.getByTestId('geom-length')).toBeVisible();
    await expect(page.getByTestId('geom-length')).toHaveValue('9');
    // второй init ушёл инкрементально (since=<lastSyncAt>)
    const reloadPull = pullRequests.find(u => u.includes('since='));
    expect(reloadPull).toBeDefined();
  });
});
