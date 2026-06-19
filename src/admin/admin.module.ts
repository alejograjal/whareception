import { Module } from '@nestjs/common';
import { ConversationsModule } from '../conversations/conversations.module';
import { AdminController } from './admin.controller';
import { AdminTokenGuard } from './admin-token.guard';

@Module({
  imports: [ConversationsModule],
  controllers: [AdminController],
  providers: [AdminTokenGuard],
})
export class AdminModule {}
