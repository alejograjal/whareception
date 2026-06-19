import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { Env } from '../config/env.schema';

/**
 * Verifies the X-Hub-Signature-256 header Meta sends with every webhook POST,
 * computed as HMAC-SHA256(appSecret, rawBody). Requires the raw request body
 * (enabled via `rawBody: true` at bootstrap).
 *
 * When WHATSAPP_APP_SECRET is not configured (local dev / simulated payloads)
 * verification is skipped so testing without a real Meta signature works.
 */
@Injectable()
export class MetaSignatureGuard implements CanActivate {
  private readonly logger = new Logger(MetaSignatureGuard.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const appSecret = this.config.get('WHATSAPP_APP_SECRET', { infer: true });
    if (!appSecret) {
      this.logger.warn(
        'WHATSAPP_APP_SECRET not set — skipping webhook signature verification.',
      );
      return true;
    }

    const req = context
      .switchToHttp()
      .getRequest<Request & { rawBody?: Buffer }>();
    const header = req.header('x-hub-signature-256');
    if (!header || !req.rawBody) {
      throw new UnauthorizedException('Missing webhook signature');
    }

    const expected =
      'sha256=' +
      createHmac('sha256', appSecret).update(req.rawBody).digest('hex');

    const a = Buffer.from(header);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    return true;
  }
}
