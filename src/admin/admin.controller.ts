import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ConversationsService } from '../conversations/conversations.service';
import { AdminTokenGuard } from './admin-token.guard';

/**
 * Minimal operational endpoints for the pilot. Protected by AdminTokenGuard
 * (x-admin-token header). A full admin UI is out of scope for now.
 */
@Controller('admin')
@UseGuards(AdminTokenGuard)
export class AdminController {
  constructor(private readonly conversations: ConversationsService) {}

  /**
   * Marks a handoff resolved and hands the conversation back to the bot.
   * Use after a human has finished assisting the customer.
   */
  @Post('handoffs/:id/resolve')
  async resolveHandoff(@Param('id') id: string) {
    const { conversationId } = await this.conversations.resolveHandoff(id);
    return { resolved: true, conversationId };
  }
}
