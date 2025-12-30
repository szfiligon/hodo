import { defineConfig } from 'drizzle-kit';
import { getDatabasePath } from './src/lib/user-data';

export default defineConfig({
  schema: './src/lib/db.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: getDatabasePath(),
  },
}); 