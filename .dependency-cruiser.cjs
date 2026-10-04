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
      severity: 'warn',
      comment:
        'R1 (мягкий режим): слой app может зависеть только от features и shared. ' +
        'Легаси-пути во временном allowlist до R4.',
      from: { path: '^src/app' },
      to: {
        pathNot: [
          '^src/app(/|$)', // внутри app — допустимо
          '^(src/features|shared/|@shared)', // строго вниз по 3-слойке
          // Легаси-allowlist (R4: удалить строку и повысить правило до error):
          '^(src/components|src/hooks|src/contexts|src/api|src/utils)'
        ]
      }
    },
    {
      name: 'fsd-features-to-shared',
      severity: 'warn',
      comment:
        'R1 (мягкий режим): features зависят только от shared и собственной фичи. ' +
        'Легаси-пути во временном allowlist до R4.',
      from: { path: '^src/features/([^/]+)' },
      to: {
        pathNot: [
          '^src/features/$1(/|$)', // своя фича — допустимо
          '^src/features(/|$)', // features→features флагует только fsd-features-no-cross-imports
          '^(shared/|@shared)', // строго вниз по 3-слойке
          // Легаси-allowlist (R4: удалить строку и повысить правило до error):
          '^(src/components|src/hooks|src/contexts|src/api|src/utils)'
        ]
      }
    },
    {
      name: 'fsd-features-no-cross-imports',
      severity: 'warn',
      comment:
        'R1 (мягкий режим): фичи не импортируют друг друга напрямую — только через shared. ' +
        'В R4 повышается до error.',
      from: { path: '^src/features/([^/]+)' },
      to: { path: '^src/features/(?!$1(/|$))' }
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
