import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AppointmentsService } from './appointments.service';

@Module({
  imports: [NotificationsModule],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
