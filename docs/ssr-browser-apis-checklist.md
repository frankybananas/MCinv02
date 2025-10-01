# SSR & Browser APIs – Checklist and Optional Lint

Use this checklist during reviews to prevent SSR build failures and hydration issues.

## Checklist (Code Review)

- [ ] No `window`/`document`/`navigator`/`localStorage`/`FileReader`/`Image`/`createImageBitmap`/`URL` at module scope.
- [ ] Any browser APIs are used only in files that start with `"use client"` or inside functions guarded with `typeof window !== 'undefined'`.
- [ ] Heavy browser-only logic (compression, canvas, camera) lives in client-only modules and is loaded via dynamic `import()` from a user action or guarded `useEffect`.
- [ ] Do not import client-only helpers at module scope of shared components. Use `await import('...client')` inside handlers or effects.
- [ ] In `next.config.mjs`, keep experimental flags minimal while stabilizing; avoid duplicate keys.

## Patterns

- Guarded usage in effects:
```ts
useEffect(() => {
  if (typeof window === 'undefined') return;
  const v = window.localStorage.getItem('key');
  // ...
}, []);
```

- Dynamic import (client-only helper):
```ts
async function onPickFiles(files: File[]) {
  try {
    const { compressImage } = await import('../components/image-compression.client');
    const out = [] as File[];
    for (const f of files) out.push(await compressImage(f));
    // use out
  } catch {
    // fallback: use originals
  }
}
```

- Event-handler only access:
```ts
<button onClick={() => { window.location.href = '/admin'; }}>Go Admin</button>
```

## Optional ESLint (opt-in)

If you want lint enforcement later, add this minimal rule set (requires `eslint` and `@typescript-eslint/parser`). This flags direct usage of `window`/`document` at module scope and suggests guarding.

Create `.eslintrc.cjs` (or merge into your config):
```js
/* eslint-env node */
module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  rules: {
    // Warn on window/document at module scope
    'no-restricted-globals': ['warn', 'window', 'document'],
    // Basic guard pattern reminder
    'no-restricted-syntax': [
      'warn',
      {
        selector: "Program > ExpressionStatement[expression.type='MemberExpression'][expression.object.name='window']",
        message: 'Avoid window at module scope; move into guarded function or client component.',
      },
      {
        selector: "Program > ExpressionStatement[expression.type='MemberExpression'][expression.object.name='document']",
        message: 'Avoid document at module scope; move into guarded function or client component.',
      },
    ],
  },
  overrides: [
    {
      files: ['**/*.{ts,tsx}'],
      rules: {},
    },
  ],
};
```

Note: Next.js already provides good defaults. This optional snippet is lightweight and meant as a reminder, not strict enforcement. Keep `"use client"` at the top of files that need browser APIs.
