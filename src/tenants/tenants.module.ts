import { Module } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';
import { AdminTokenGuard } from '../admin/admin-token.guard';

@Module({
  controllers: [TenantsController],
  providers: [TenantsService, AdminTokenGuard],
  exports: [TenantsService],
})
export class TenantsModule {}
