import { defineConfig } from 'vitest/config';

// Suite hermética: Postgres (prisma) y Neo4j (runQuery) se mockean en cada
// test, así corre en CI sin Aura ni una DB real. Cloudinary también está
// stubbeado (las rutas caen a su rama sin credenciales en el entorno de test).
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./test/setup.js'],
    include: ['test/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: ['src/routes/**', 'src/services/**'],
      // El objetivo de la Etapa 5 es 30% en routes/ + services/.
      thresholds: { lines: 30, functions: 30, statements: 30 },
    },
  },
});
