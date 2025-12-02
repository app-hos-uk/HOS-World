import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { ApiResponse, Address } from '@hos-marketplace/shared-types';

@Controller('addresses')
@UseGuards(JwtAuthGuard)
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Request() req: any,
    @Body() createAddressDto: CreateAddressDto,
  ): Promise<ApiResponse<Address>> {
    const address = await this.addressesService.create(req.user.id, createAddressDto);
    return {
      data: address,
      message: 'Address created successfully',
    };
  }

  @Get()
  async findAll(@Request() req: any): Promise<ApiResponse<Address[]>> {
    const addresses = await this.addressesService.findAll(req.user.id);
    return {
      data: addresses,
      message: 'Addresses retrieved successfully',
    };
  }

  @Get(':id')
  async findOne(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<Address>> {
    const address = await this.addressesService.findOne(id, req.user.id);
    return {
      data: address,
      message: 'Address retrieved successfully',
    };
  }

  @Put(':id')
  async update(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAddressDto: UpdateAddressDto,
  ): Promise<ApiResponse<Address>> {
    const address = await this.addressesService.update(id, req.user.id, updateAddressDto);
    return {
      data: address,
      message: 'Address updated successfully',
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<{ message: string }>> {
    await this.addressesService.delete(id, req.user.id);
    return {
      data: { message: 'Address deleted successfully' },
      message: 'Address deleted successfully',
    };
  }

  @Post(':id/set-default')
  @HttpCode(HttpStatus.OK)
  async setDefault(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<Address>> {
    const address = await this.addressesService.setDefault(id, req.user.id);
    return {
      data: address,
      message: 'Default address updated successfully',
    };
  }
}


