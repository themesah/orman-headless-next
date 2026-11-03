import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // server-only throws outside a React Server build; the tests run in plain Node.
  resolve: { alias: { 'server-only': fileURLToPath(new URL('./tests/server-only-stub.ts', import.meta.url)) } },
  test: { environment: 'node', include: ['tests/**/*.test.{ts,tsx}'] },
})
