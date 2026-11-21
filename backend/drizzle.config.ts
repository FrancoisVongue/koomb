import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/services/database/schema.ts',
  out: './src/services/database/migrations',
});
