import { defineConfig } from 'tsup'

// dist is committed (consumers install by git tag, no build on install), so the output must be stable:
// one file per entry, no splitting, no minify, no sourcemaps.
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    types: 'src/types.ts',
    client: 'src/client.ts',
    proxy: 'src/proxy.ts',
    csrf: 'src/csrf.ts',
    form: 'src/components/form.tsx',
    captcha: 'src/components/captcha.tsx',
    'form-fields': 'src/components/form-fields.tsx',
    'maintenance-page': 'src/components/maintenance-page.tsx',
    roadmap: 'src/components/roadmap.ts',
    'account-api': 'src/components/account-api.ts',
    stream: 'src/components/stream.ts',
    login: 'src/components/login.tsx',
    'two-factor': 'src/components/two-factor.tsx',
    sessions: 'src/components/sessions.tsx',
    comments: 'src/components/comments.tsx',
    inbox: 'src/components/inbox.tsx',
    analytics: 'src/components/analytics.tsx',
    'not-found': 'src/components/not-found.tsx',
    'code-check': 'src/components/code-check.tsx',
    shop: 'src/components/shop.tsx',
    courses: 'src/components/courses.tsx',
    scoring: 'src/components/scoring.tsx',
    bard: 'src/components/bard.tsx',
  },
  format: ['esm'],
  dts: true,
  splitting: false,
  clean: true,
  target: 'es2022',
  // The package's own entries stay external, so `captcha` and `form-fields` use the one `form` (its React context) the app imports.
  external: ['next', 'react', 'react-dom', 'server-only', /^next\//, /^@orman\/headless-next\//],
  // The form, the captcha and the field renderer need the browser; the directive must survive bundling.
  esbuildOptions(options) {
    options.jsx = 'automatic'
  },
  async onSuccess() {
    const { readFile, writeFile } = await import('node:fs/promises')
    for (const file of ['form', 'captcha', 'form-fields', 'login', 'two-factor', 'sessions', 'comments', 'inbox', 'analytics', 'not-found', 'code-check', 'shop', 'courses', 'scoring'].map(n => `dist/${n}.js`)) {
      const source = await readFile(file, 'utf8')
      if (!source.startsWith('"use client"')) await writeFile(file, `"use client";\n${source}`)
    }
  },
})
