import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Env } from '../config/env.schema';

/**
 * Thin wrapper around an ioredis client. Exposes the raw client plus a few
 * JSON helpers used by the conversation state store.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;

  constructor(private readonly config: ConfigService<Env, true>) {
    const url = this.config.get('REDIS_URL', { infer: true });
    this.client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 2 });
    this.client.on('error', (err) =>
      this.logger.error(`Redis error: ${err.message}`),
    );
  }

  async onModuleInit(): Promise<void> {
    await this.client.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async setJson(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const raw = JSON.stringify(value);
    if (ttlSeconds && ttlSeconds > 0) {
      await this.client.set(key, raw, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, raw);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }
}
