import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Request, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AddressesService } from './addresses.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/create-address.dto';
import { GatewayAuthGuard } from '@hos-marketplace/auth-common';

@ApiTags('addresses')
@ApiBearerAuth('JWT-auth')
@Controller('addresses')
@UseGuards(GatewayAuthGuard)
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Request() req: any, @Body() dto: CreateAddressDto) {
    const addr = await this.addressesService.create(req.user.id, dto);
    return { data: addr, message: 'Address created' };
  }

  @Get()
  async findAll(@Request() req: any) {
    const addresses = await this.addressesService.findAll(req.user.id);
    return { data: addresses, message: 'Addresses retrieved' };
  }

  @Get(':id')
  async findOne(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    const addr = await this.addressesService.findOne(id, req.user.id);
    return { data: addr, message: 'Address retrieved' };
  }

  @Put(':id')
  async update(@Request() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAddressDto) {
    const addr = await this.addressesService.update(id, req.user.id, dto);
    return { data: addr, message: 'Address updated' };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    await this.addressesService.delete(id, req.user.id);
    return { data: { message: 'Address deleted' }, message: 'Address deleted' };
  }

  @Post(':id/set-default')
  @HttpCode(HttpStatus.OK)
  async setDefault(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    const addr = await this.addressesService.setDefault(id, req.user.id);
    return { data: addr, message: 'Default address updated' };
  }
}
