import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppointmentRequest } from '@prisma/client';
import { asLanguage, t } from '../common/i18n/messages';
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
    const summary = this.buildAppointmentSummary(tenant, appointment);
    await this.dispatch(tenant, summary);
  }

  async notifyHandoff(
    tenant: TenantConfig,
    reason: string,
    customerPhone: string,
    triggeringMessage: string,
  ): Promise<void> {
    const s = t(asLanguage(tenant.defaultLanguage)).summary;
    const summary = [
      s.handoffTitle,
      '',
      `${s.reason}: ${reason}`,
      `${s.customer}: ${customerPhone}`,
      `${s.message}: ${triggeringMessage}`,
      '',
      s.followUp,
    ].join('\n');
    await this.dispatch(tenant, summary);
  }

  private buildAppointmentSummary(
    tenant: TenantConfig,
    a: AppointmentRequest,
  ): string {
    const s = t(asLanguage(tenant.defaultLanguage)).summary;
    return [
      s.appointmentTitle,
      '',
      `${s.customer}: ${a.customerName ?? s.unknown}`,
      `${s.pet}: ${a.petName ?? s.unknown}`,
      `${s.petType}: ${a.petType ?? s.unknown}`,
      `${s.service}: ${a.serviceName ?? s.unknown}`,
      `${s.preferredTime}: ${a.preferredTime ?? s.notSpecified}`,
      `${s.urgency}: ${a.isEmergency ? s.emergency : s.normal}`,
      `${s.phone}: ${a.phone ?? s.unknown}`,
      '',
      s.pendingConfirmation,
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
