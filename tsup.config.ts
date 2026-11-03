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
    'maintenance-page': 'src/components/maintenance-page.tsx',
    roadmap: 'src/components/roadmap.ts',
  },
  format: ['esm'],
  dts: true,
  splitting: false,
  clean: true,
  target: 'es2022',
  external: ['next', 'react', 'react-dom', 'server-only', /^next\//],
  // Only the form needs the browser; the directive must survive bundling.
  esbuildOptions(options) {
    options.jsx = 'automatic'
  },
  async onSuccess() {
    const { readFile, writeFile } = await import('node:fs/promises')
    const file = 'dist/form.js'
    const source = await readFile(file, 'utf8')
    if (!source.startsWith('"use client"')) await writeFile(file, `"use client";\n${source}`)
  },
})
