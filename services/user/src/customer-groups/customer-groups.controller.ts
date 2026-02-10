import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CustomerGroupsService } from './customer-groups.service';
import { GatewayAuthGuard, RolesGuard, Roles } from '@hos-marketplace/auth-common';

@ApiTags('customer-groups')
@Controller('customer-groups')
@UseGuards(GatewayAuthGuard, RolesGuard)
@Roles('ADMIN', 'MARKETING')
@ApiBearerAuth('JWT-auth')
export class CustomerGroupsController {
  constructor(private readonly svc: CustomerGroupsService) {}

  @Post()
  async create(@Body() dto: any) {
    const group = await this.svc.create(dto);
    return { data: group, message: 'Customer group created' };
  }

  @Get()
  async findAll(@Query('includeInactive') includeInactive?: string) {
    const groups = await this.svc.findAll(includeInactive === 'true');
    return { data: groups, message: 'Customer groups retrieved' };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const group = await this.svc.findOne(id);
    return { data: group, message: 'Customer group retrieved' };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: any) {
    const group = await this.svc.update(id, dto);
    return { data: group, message: 'Customer group updated' };
  }

  @Post(':id/customers/:userId')
  async addCustomer(@Param('id') id: string, @Param('userId') userId: string) {
    const user = await this.svc.addCustomerToGroup(id, userId);
    return { data: user, message: 'Customer added to group' };
  }

  @Delete('customers/:userId')
  async removeCustomer(@Param('userId') userId: string) {
    const user = await this.svc.removeCustomerFromGroup(userId);
    return { data: user, message: 'Customer removed from group' };
  }
}
