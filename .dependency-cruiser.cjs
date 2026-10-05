/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'This dependency is part of a circular relationship.',
      from: {},
      to: { circular: true }
    },
    {
      name: 'not-to-unresolvable',
      comment: 'This module depends on a module that cannot be found.',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true }
    },
    {
      name: 'no-orphans',
      comment: 'This is an orphan module - it is likely not used.',
      severity: 'warn',
      from: { orphan: true },
      to: {}
    },
    {
      name: 'no-utils-to-components',
      severity: 'error',
      comment: 'Utils layer cannot depend on UI components.',
      from: { path: "^src/utils" },
      to: { path: "^src/components" }
    },
    {
      name: 'no-api-to-components',
      severity: 'error',
      comment: 'API layer cannot depend on UI components.',
      from: { path: "^src/api" },
      to: { path: "^src/components" }
    },
    {
      name: 'no-store-to-components',
      severity: 'error',
      comment: 'Store layer cannot depend on UI components.',
      from: { path: "^src/store" },
      to: { path: "^src/components" }
    },
    {
      name: 'no-domain-to-react',
      severity: 'error',
      comment: 'Domain layer cannot depend on React or UI components.',
      from: { path: "^src/domain" },
      to: { path: "(^src/components)|(^react$)|(^react-dom$)" }
    },

    // ─── FSD-каркас (R1, «мягкий режим») ────────────────────────────────────────
    // См. devAI/spec/ROADMAP-fsd.md и docs/ARCHITECTURE.md «Переезд FSD».
    // В R4: легаси-allowlist пустеет, все три правила повышаются с warn до error.
    {
      name: 'fsd-app-layers',
      severity: 'error',
      comment:
        'R4 batch 029 (финал): слой app (src/app + src/App.tsx) может зависеть только ' +
        'от features и shared. Легаси-allowlist пересмотрен в R4 029: оставлены ' +
        'инфраструктурные корни (store/hooks/contexts/api/utils/domain/types/data), ' +
        'которые не входят в скоуп R4 (см. developer_log); легаси-каталоги компонентов ' +
        '(src/components) из allowlist удалены.',
      from: { path: '^src/app' },
      to: {
        pathNot: [
          '^src/app(/|$)', // внутри app — допустимо
          '^(src/features|shared/|@shared)', // строго вниз по 3-слойке
          '^node_modules', // фреймворк/библиотеки (react, lucide-react) — не легаси-пути
          // Легаси-allowlist, пересмотрен в R4 029/030 (см. developer_log):
          // src/components удалён из allowlist и из репо (батч 030, фасады сняты).
          '^(src/store|src/hooks|src/contexts|src/api|src/utils|src/domain|src/types|src/data)'
        ]
      }
    },
    {
      name: 'fsd-features-to-shared',
      severity: 'warn',
      comment:
        'R1 (мягкий режим): features зависят только от shared и собственной фичи. ' +
        'R4 029: allowlist пересмотрен — легаси-каталоги компонентов удалены; остаются ' +
        'инфраструктурные корни (store/api/utils/domain/types/data/contexts), их вынос ' +
        'в shared вне скоупа R4 (см. developer_log). Повышение до error — пост-R4.',
      from: { path: '^src/features/([^/]+)' },
      to: {
        pathNot: [
          '^src/features/$1(/|$)', // своя фича — допустимо
          '^src/features(/|$)', // features→features флагует только fsd-features-no-cross-imports
          '^(shared/|@shared)', // строго вниз по 3-слойке
          '^node_modules', // фреймворк/библиотеки (react, lucide-react) — не легаси-пути
          // Легаси-allowlist, пересмотрен в R4 029/030 (см. developer_log):
          // src/components удалён из allowlist и из репо (батч 030, фасады сняты).
          '^(src/store|src/hooks|src/contexts|src/api|src/utils|src/domain|src/types|src/data)'
        ]
      }
    },
    {
      name: 'fsd-features-no-cross-imports',
      severity: 'error',
      comment:
        'R4 batch 029 (финал): фичи не импортируют друг друга напрямую — только через ' +
        'shared или легаси-фасады. Повышено с warn до error. ИСКЛЮЧЕНИЕ rooms (см. ' +
        'fsd-works-no-cross-imports): RoomEditor — точка композиции rooms-домена, ' +
        'rooms→works разрешён осознанно.',
      from: { path: '^src/features/([^/]+)', pathNot: '^src/features/rooms' },
      to: { path: '^src/features/(?!$1(/|$))' }
    },

    // ─── R4 batch 024: домен auth готов — его правило повышено до error ─────────
    {
      name: 'fsd-auth-no-cross-imports',
      severity: 'error',
      comment:
        'R4 batch 024: auth — первый готовый домен features. Любая ДРУГАЯ фича не может ' +
        'импортировать src/features/auth напрямую (только shared / легаси-фасады).',
      from: { path: '^src/features/(?!auth(/|$))' },
      to: { path: '^src/features/auth' }
    },

    // ─── R4 batch 025: домен works готов — его правило повышено до error ────────
    {
      name: 'fsd-works-no-cross-imports',
      severity: 'error',
      comment:
        'R4 batch 025: works — готовый домен features. Любая ДРУГАЯ фича не может ' +
        'импортировать src/features/works напрямую (только shared / легаси-фасады). ' +
        'ИСКЛЮЧЕНИЕ rooms (батч 027): RoomEditor — точка композиции rooms-домена; ещё до R4 ' +
        '(батч 025, из легаси src/components/RoomEditor.tsx) он собирал works-компоненты ' +
        '(WorkList, WorkCard, WorkTemplatePickerModal, WorkCatalogPicker, useWorkTemplates). ' +
        'rooms→works разрешён осознанно, см. developer_log.',
      from: { path: '^src/features/(?!works(/|$))', pathNot: '^src/features/rooms' },
      to: { path: '^src/features/works' }
    },

    // ─── R4 batch 026: домен summary готов — его правило повышено до error ─────
    {
      name: 'fsd-summary-no-cross-imports',
      severity: 'error',
      comment:
        'R4 batch 026: summary — готовый домен features. Любая ДРУГАЯ фича не может ' +
        'импортировать src/features/summary напрямую (только shared / легаси-фасады).',
      from: { path: '^src/features/(?!summary(/|$))' },
      to: { path: '^src/features/summary' }
    },

    // ─── R4 batch 027: домен rooms готов — его правило повышено до error ──────
    {
      name: 'fsd-rooms-no-cross-imports',
      severity: 'error',
      comment:
        'R4 batch 027: rooms — готовый домен features. Любая ДРУГАЯ фича не может ' +
        'импортировать src/features/rooms напрямую (только shared / легаси-фасады). ' +
        'rooms→works (RoomEditor) разрешён явным исключением в fsd-works-no-cross-imports.',
      from: { path: '^src/features/(?!rooms(/|$))' },
      to: { path: '^src/features/rooms' }
    },

    // ─── R4 batch 028: домен objects готов — его правило повышено до error ─────
    {
      name: 'fsd-objects-no-cross-imports',
      severity: 'error',
      comment:
        'R4 batch 028: objects — готовый домен features. Любая ДРУГАЯ фича не может ' +
        'импортировать src/features/objects напрямую (только shared / легаси-фасады).',
      from: { path: '^src/features/(?!objects(/|$))' },
      to: { path: '^src/features/objects' }
    },

    // ─── R4 batch 029: домены projects и backup готовы — error ────────────────
    {
      name: 'fsd-projects-no-cross-imports',
      severity: 'error',
      comment:
        'R4 batch 029: projects — готовый домен features. Любая ДРУГАЯ фича не может ' +
        'импортировать src/features/projects напрямую (только shared / легаси-фасады).',
      from: { path: '^src/features/(?!projects(/|$))' },
      to: { path: '^src/features/projects' }
    },
    {
      name: 'fsd-backup-no-cross-imports',
      severity: 'error',
      comment:
        'R4 batch 029: backup — готовый домен features. Любая ДРУГАЯ фича не может ' +
        'импортировать src/features/backup напрямую (только shared / легаси-фасады). ' +
        'ИСКЛЮЧЕНИЕ: backup→rooms (createRoom при pull-синхронизации) идёт через ' +
        'легаси-фасад src/api/rooms, не напрямую (R4 030: src/components удалён).',
      from: { path: '^src/features/(?!backup(/|$))' },
      to: { path: '^src/features/backup' }
    }
  ],
  options: {
    doNotFollow: {
      path: 'node_modules'
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.app.json'
    }
  }
};
