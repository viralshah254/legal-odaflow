/**
 * Resolve `@/*` path aliases at runtime for compiled dist output.
 * TypeScript emits `require("@/…")` unchanged; Node needs this before AppModule loads.
 */
import { register } from 'tsconfig-paths';
import { join } from 'path';

register({
  baseUrl: join(__dirname, '..'),
  paths: { '@/*': ['dist/*'] },
});
