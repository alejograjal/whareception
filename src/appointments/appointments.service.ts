import { Injectable } from '@nestjs/common';
import { AppointmentRequest } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TenantConfig } from '../tenants/tenants.service';
import { AppointmentSlots } from '../common/types';

export interface CreateAppointmentInput {
  tenant: TenantConfig;
  conversationId: string;
  customerId: string;
  customerPhone: string;
  slots: AppointmentSlots;
}

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Persists a structured appointment request (lead_only mode) and notifies
   * the business team. The bot never confirms the appointment — status is
   * always pending_confirmation.
   */
  async createFromSlots(
    input: CreateAppointmentInput,
  ): Promise<AppointmentRequest> {
    const { slots } = input;
    const appointment = await this.prisma.appointmentRequest.create({
      data: {
        tenantId: input.tenant.id,
        conversationId: input.conversationId,
        customerId: input.customerId,
        customerName: slots.customerName ?? null,
        petName: slots.petName ?? null,
        petType: slots.petType ?? null,
        serviceName: slots.serviceName ?? null,
        reason: slots.reason ?? null,
        preferredTime: slots.preferredTime ?? null,
        isEmergency: slots.isEmergency ?? false,
        phone: input.customerPhone,
        status: 'pending_confirmation',
      },
    });

    await this.notifications.notifyAppointmentRequest(input.tenant, appointment);
    return appointment;
  }
}
