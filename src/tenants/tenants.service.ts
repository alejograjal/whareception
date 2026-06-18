import { Injectable, NotFoundException } from '@nestjs/common';
import { Faq, Service, Tenant } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type TenantConfig = Tenant & {
  services: Service[];
  faqs: Faq[];
};

/**
 * Loads and caches tenant configuration. The MVP resolves tenants by slug
 * (used by the simulation endpoint); resolution by WhatsApp phone number is
 * added in Phase 2.
 */
@Injectable()
export class TenantsService {
  // Simple in-process cache. Invalidated by TTL; safe for the MVP since tenant
  // config changes are rare and there is a single instance.
  private readonly cache = new Map<
    string,
    { value: TenantConfig; expiresAt: number }
  >();
  private readonly ttlMs = 60_000;

  constructor(private readonly prisma: PrismaService) {}

  async getBySlug(slug: string): Promise<TenantConfig> {
    const cached = this.cache.get(slug);
    if (cached && cached.expiresAt > this.now()) {
      return cached.value;
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      include: {
        services: { where: { active: true } },
        faqs: { where: { active: true } },
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Unknown tenant: ${slug}`);
    }

    this.cache.set(slug, {
      value: tenant,
      expiresAt: this.now() + this.ttlMs,
    });
    return tenant;
  }

  invalidate(slug: string): void {
    this.cache.delete(slug);
  }

  private now(): number {
    return Date.now();
  }
}
