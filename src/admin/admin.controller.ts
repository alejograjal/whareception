import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConversationsService } from '../conversations/conversations.service';
import { AdminTokenGuard } from './admin-token.guard';

/**
 * Minimal operational endpoints for the pilot. Protected by AdminTokenGuard
 * (x-admin-token header). A full admin UI is out of scope for now.
 */
@ApiTags('admin')
@ApiHeader({ name: 'x-admin-token', description: 'Admin shared secret', required: true })
@Controller('admin')
@UseGuards(AdminTokenGuard)
export class AdminController {
  constructor(private readonly conversations: ConversationsService) {}

  /**
   * Marks a handoff resolved and hands the conversation back to the bot.
   * Use after a human has finished assisting the customer.
   */
  @Post('handoffs/:id/resolve')
  @ApiOperation({
    summary: 'Resolver un handoff y devolver la conversación al bot',
  })
  async resolveHandoff(@Param('id') id: string) {
    const { conversationId } = await this.conversations.resolveHandoff(id);
    return { resolved: true, conversationId };
  }
}
