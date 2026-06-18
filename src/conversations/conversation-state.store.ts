import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env.schema';
import { RedisService } from '../redis/redis.service';
import { ConversationState } from '../common/types';

/**
 * Stores live, in-progress conversation state (current flow, step and
 * collected slots) in Redis, keyed by tenant + customer phone. Durable
 * history lives in Postgres; this is just the working memory between
 * customer messages and expires after CONVERSATION_STATE_TTL.
 */
@Injectable()
export class ConversationStateStore {
  private readonly ttl: number;

  constructor(
    private readonly redis: RedisService,
    config: ConfigService<Env, true>,
  ) {
    this.ttl = config.get('CONVERSATION_STATE_TTL', { infer: true });
  }

  private key(tenantSlug: string, phone: string): string {
    return `conv:${tenantSlug}:${phone}`;
  }

  async get(
    tenantSlug: string,
    phone: string,
  ): Promise<ConversationState | null> {
    return this.redis.getJson<ConversationState>(this.key(tenantSlug, phone));
  }

  async save(
    tenantSlug: string,
    phone: string,
    state: ConversationState,
  ): Promise<void> {
    await this.redis.setJson(
      this.key(tenantSlug, phone),
      { ...state, updatedAt: new Date().toISOString() },
      this.ttl,
    );
  }

  async clear(tenantSlug: string, phone: string): Promise<void> {
    await this.redis.del(this.key(tenantSlug, phone));
  }
}
