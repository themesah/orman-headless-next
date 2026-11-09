import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // server-only throws outside a React Server build; the tests run in plain Node.
  resolve: {
    alias: {
      'server-only': fileURLToPath(new URL('./tests/server-only-stub.ts', import.meta.url)),
      // The components import each other through the package name (so the built files share one copy of the form's context).
      '@orman/headless-next/form': fileURLToPath(new URL('./src/components/form.tsx', import.meta.url)),
      '@orman/headless-next/form-fields': fileURLToPath(new URL('./src/components/form-fields.tsx', import.meta.url)),
      '@orman/headless-next/captcha': fileURLToPath(new URL('./src/components/captcha.tsx', import.meta.url)),
    },
  },
  test: { environment: 'node', include: ['tests/**/*.test.{ts,tsx}'] },
})
