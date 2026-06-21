import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { Env } from './config/env.schema';

async function bootstrap() {
  // rawBody is required to verify the Meta webhook signature.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  // Validation is handled per-route with ZodValidationPipe (see DTOs).
  app.enableShutdownHooks();

  // Interactive API docs at /docs.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('WhaReception API')
    .setDescription(
      'Plataforma de recepcionista de WhatsApp multi-tenant. ' +
        'Endpoints de simulación, webhook de Meta, administración y alta de negocios.',
    )
    .setVersion('0.1.0')
    .addApiKey(
      { type: 'apiKey', name: 'x-admin-token', in: 'header' },
      'admin-token',
    )
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const config = app.get(ConfigService<Env, true>);
  const port = config.get('PORT', { infer: true });

  await app.listen(port);
  Logger.log(`WhaReception listening on http://localhost:${port}`, 'Bootstrap');
  Logger.log(`API docs at http://localhost:${port}/docs`, 'Bootstrap');
}

void bootstrap();
