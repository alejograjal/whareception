import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env.schema';
import { MetaWhatsAppClient } from './meta-whatsapp.client';
import { MockWhatsAppClient } from './mock-whatsapp.client';
import { WHATSAPP_CLIENT } from './whatsapp-client.interface';

/**
 * Dependency-free module that provides the outbound WhatsApp client. Kept
 * separate from the WhatsApp controller module so notification senders can
 * depend on the client without creating an import cycle with the
 * conversation engine.
 */
@Module({
  providers: [
    MockWhatsAppClient,
    MetaWhatsAppClient,
    {
      provide: WHATSAPP_CLIENT,
      inject: [ConfigService, MockWhatsAppClient, MetaWhatsAppClient],
      useFactory: (
        config: ConfigService<Env, true>,
        mock: MockWhatsAppClient,
        meta: MetaWhatsAppClient,
      ) =>
        config.get('WHATSAPP_PROVIDER', { infer: true }) === 'meta'
          ? meta
          : mock,
    },
  ],
  exports: [WHATSAPP_CLIENT],
})
export class WhatsAppClientModule {}
