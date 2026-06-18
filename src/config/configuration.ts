import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './env.schema';

/**
 * Global configuration module. Loads `.env`, validates it with Zod,
 * and exposes the typed values through Nest's ConfigService.
 */
export const AppConfigModule = ConfigModule.forRoot({
  isGlobal: true,
  cache: true,
  validate: validateEnv,
});
