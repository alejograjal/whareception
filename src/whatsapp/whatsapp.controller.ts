import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
  Query,
  UsePipes,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env.schema';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { WhatsAppService } from './whatsapp.service';
import {
  SimulateMessageDto,
  simulateMessageSchema,
} from './dto/simulate-message.dto';

@Controller()
export class WhatsAppController {
  constructor(
    private readonly whatsapp: WhatsAppService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Local simulation endpoint. Lets the conversation engine be exercised
   * without a real WhatsApp integration.
   *
   *   POST /sim/messages
   *   { "tenantId": "demo-vet", "from": "+50688888888", "message": "..." }
   */
  @Post('sim/messages')
  @UsePipes(new ZodValidationPipe(simulateMessageSchema))
  async simulate(@Body() dto: SimulateMessageDto) {
    const result = await this.whatsapp.processInbound(
      dto.tenantId,
      dto.from,
      dto.message,
    );
    return {
      reply: result.reply,
      intent: result.intent,
      createdAppointmentId: result.createdAppointmentId ?? null,
      createdHandoffId: result.createdHandoffId ?? null,
    };
  }

  /**
   * Meta webhook verification handshake (GET). Phase 2 wires real message
   * receiving; this endpoint is functional now so the webhook can be
   * registered.
   */
  @Get('webhooks/whatsapp')
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    const expected = this.config.get('WHATSAPP_VERIFY_TOKEN', { infer: true });
    if (mode === 'subscribe' && token === expected) {
      return challenge;
    }
    throw new ForbiddenException('Webhook verification failed');
  }

  /**
   * Meta webhook receiver (POST). For now it persists the raw event for audit;
   * full normalization + engine dispatch lands in Phase 2.
   */
  @Post('webhooks/whatsapp')
  @HttpCode(200)
  async receive(@Body() payload: unknown): Promise<{ received: true }> {
    await this.whatsapp.recordWebhookEvent(payload);
    return { received: true };
  }
}
