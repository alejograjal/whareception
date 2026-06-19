import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Env } from '../config/env.schema';

/**
 * Guards /admin/* routes with a shared secret sent as the `x-admin-token`
 * header. When ADMIN_TOKEN is not configured the admin routes are disabled
 * entirely (always 403) so they are never accidentally left open.
 */
@Injectable()
export class AdminTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService<Env, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get('ADMIN_TOKEN', { infer: true });
    if (!expected) {
      throw new ForbiddenException('Admin endpoints are disabled');
    }
    const req = context.switchToHttp().getRequest<Request>();
    if (req.header('x-admin-token') !== expected) {
      throw new ForbiddenException('Invalid admin token');
    }
    return true;
  }
}
