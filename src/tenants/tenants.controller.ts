import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AdminTokenGuard } from '../admin/admin-token.guard';
import { TenantsService } from './tenants.service';
import {
  CreateTenantDto,
  createTenantSchema,
} from './dto/create-tenant.dto';

@ApiTags('tenants (admin)')
@ApiHeader({ name: 'x-admin-token', description: 'Admin shared secret', required: true })
@Controller('tenants')
@UseGuards(AdminTokenGuard)
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar negocios (tenants)' })
  list() {
    return this.tenants.list();
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Obtener un negocio por slug, con servicios y FAQs' })
  get(@Param('slug') slug: string) {
    return this.tenants.getBySlug(slug);
  }

  @Post()
  @ApiOperation({
    summary: 'Crear un negocio con sus servicios y FAQs',
    description:
      'Da de alta un tenant completo en una sola llamada. El slug debe ser ' +
      'único (minúsculas, números y guiones).',
  })
  @UsePipes(new ZodValidationPipe(createTenantSchema))
  create(@Body() dto: CreateTenantDto) {
    return this.tenants.create(dto);
  }
}
