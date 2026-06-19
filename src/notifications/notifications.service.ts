import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppointmentRequest } from '@prisma/client';
import { TenantConfig } from '../tenants/tenants.service';
import {
  WHATSAPP_CLIENT,
  WhatsAppClient,
} from '../whatsapp/whatsapp-client.interface';

/**
 * Sends structured summaries to the business team's internal WhatsApp number.
 * In the MVP this goes through the (mock) WhatsApp client.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(WHATSAPP_CLIENT) private readonly whatsapp: WhatsAppClient,
  ) {}

  async notifyAppointmentRequest(
    tenant: TenantConfig,
    appointment: AppointmentRequest,
  ): Promise<void> {
    const summary = this.buildAppointmentSummary(appointment);
    await this.dispatch(tenant, summary);
  }

  async notifyHandoff(
    tenant: TenantConfig,
    reason: string,
    customerPhone: string,
    triggeringMessage: string,
  ): Promise<void> {
    const summary = [
      'Human handoff needed',
      '',
      `Reason: ${reason}`,
      `Customer: ${customerPhone}`,
      `Message: ${triggeringMessage}`,
      '',
      'Please follow up with this customer.',
    ].join('\n');
    await this.dispatch(tenant, summary);
  }

  private buildAppointmentSummary(a: AppointmentRequest): string {
    return [
      'New appointment request',
      '',
      `Customer: ${a.customerName ?? 'Unknown'}`,
      `Pet: ${a.petName ?? 'Unknown'}`,
      `Pet type: ${a.petType ?? 'Unknown'}`,
      `Service: ${a.serviceName ?? 'Unknown'}`,
      `Preferred time: ${a.preferredTime ?? 'Not specified'}`,
      `Urgency: ${a.isEmergency ? 'Emergency' : 'Normal'}`,
      `Phone: ${a.phone ?? 'Unknown'}`,
      '',
      'Status: Pending confirmation',
    ].join('\n');
  }

  private async dispatch(tenant: TenantConfig, body: string): Promise<void> {
    if (!tenant.internalWhatsappNumber) {
      this.logger.warn(
        `Tenant ${tenant.slug} has no internalWhatsappNumber; summary not sent:\n${body}`,
      );
      return;
    }
    await this.whatsapp.sendText({
      to: tenant.internalWhatsappNumber,
      body,
      fromPhoneNumberId: tenant.whatsappPhoneNumberId ?? undefined,
    });
  }
}
