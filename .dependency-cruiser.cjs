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
