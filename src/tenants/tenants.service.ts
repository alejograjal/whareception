import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Faq, Prisma, Service, Tenant } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';

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

  /**
   * Resolves a tenant by the Meta WhatsApp phone number id the message
   * arrived on. Used by the webhook to route inbound messages.
   */
  async getByPhoneNumberId(phoneNumberId: string): Promise<TenantConfig> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { whatsappPhoneNumberId: phoneNumberId },
      include: {
        services: { where: { active: true } },
        faqs: { where: { active: true } },
      },
    });

    if (!tenant) {
      throw new NotFoundException(
        `No tenant configured for phone_number_id: ${phoneNumberId}`,
      );
    }
    return tenant;
  }

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

  /** Lightweight listing for the admin/onboarding views. */
  async list(): Promise<
    Pick<Tenant, 'id' | 'slug' | 'name' | 'industry' | 'whatsappPhoneNumberId'>[]
  > {
    return this.prisma.tenant.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        industry: true,
        whatsappPhoneNumberId: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Onboards a new business with its services and FAQs in a single
   * transaction. Throws 409 if the slug or phone number id already exists.
   */
  async create(dto: CreateTenantDto): Promise<TenantConfig> {
    try {
      const tenant = await this.prisma.tenant.create({
        data: {
          slug: dto.slug,
          name: dto.name,
          industry: dto.industry,
          timezone: dto.timezone,
          defaultLanguage: dto.defaultLanguage,
          tone: dto.tone,
          businessHours: dto.businessHours,
          locationText: dto.locationText,
          googleMapsUrl: dto.googleMapsUrl,
          internalWhatsappNumber: dto.internalWhatsappNumber,
          whatsappPhoneNumberId: dto.whatsappPhoneNumberId,
          emergencyKeywords: dto.emergencyKeywords,
          emergencyMessage: dto.emergencyMessage,
          services: { create: dto.services },
          faqs: { create: dto.faqs },
        },
        include: {
          services: { where: { active: true } },
          faqs: { where: { active: true } },
        },
      });
      return tenant;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          'A tenant with that slug or phone number id already exists.',
        );
      }
      throw err;
    }
  }

  private now(): number {
    return Date.now();
  }
}
