import { Injectable } from '@nestjs/common';
import { HandoffReason, HandoffRequest } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TenantConfig } from '../tenants/tenants.service';

export interface CreateHandoffInput {
  tenant: TenantConfig;
  conversationId: string;
  customerId: string;
  customerPhone: string;
  reason: HandoffReason;
  triggeringMessage: string;
  context?: Record<string, unknown>;
}

@Injectable()
export class HandoffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(input: CreateHandoffInput): Promise<HandoffRequest> {
    const handoff = await this.prisma.handoffRequest.create({
      data: {
        tenantId: input.tenant.id,
        conversationId: input.conversationId,
        customerId: input.customerId,
        reason: input.reason,
        context: {
          triggeringMessage: input.triggeringMessage,
          ...input.context,
        },
      },
    });

    // Move the conversation into the awaiting_human state.
    await this.prisma.conversation.update({
      where: { id: input.conversationId },
      data: { status: 'awaiting_human' },
    });

    await this.notifications.notifyHandoff(
      input.tenant,
      input.reason,
      input.customerPhone,
      input.triggeringMessage,
    );

    return handoff;
  }
}
