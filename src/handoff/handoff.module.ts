import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { HandoffService } from './handoff.service';

@Module({
  imports: [NotificationsModule],
  providers: [HandoffService],
  exports: [HandoffService],
})
export class HandoffModule {}
