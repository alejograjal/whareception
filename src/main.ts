import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Env } from './config/env.schema';

async function bootstrap() {
  // rawBody is required to verify the Meta webhook signature.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  // Validation is handled per-route with ZodValidationPipe (see DTOs).
  app.enableShutdownHooks();

  const config = app.get(ConfigService<Env, true>);
  const port = config.get('PORT', { infer: true });

  await app.listen(port);
  Logger.log(`WhaReception listening on http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();
