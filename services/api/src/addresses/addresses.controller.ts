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
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { ApiResponse, Address } from '@hos-marketplace/shared-types';

@ApiTags('addresses')
@ApiBearerAuth('JWT-auth')
@Controller('addresses')
@UseGuards(JwtAuthGuard)
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create address',
    description: 'Creates a new shipping or billing address for the authenticated user.',
  })
  @ApiBody({ type: CreateAddressDto })
  @SwaggerApiResponse({ status: 201, description: 'Address created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
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
  @ApiOperation({
    summary: 'Get all addresses',
    description: 'Retrieves all addresses for the authenticated user.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Addresses retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@Request() req: any): Promise<ApiResponse<Address[]>> {
    const addresses = await this.addressesService.findAll(req.user.id);
    return {
      data: addresses,
      message: 'Addresses retrieved successfully',
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get address by ID',
    description: 'Retrieves a specific address by ID. Users can only access their own addresses.',
  })
  @ApiParam({ name: 'id', description: 'Address UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Address retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Cannot access this address' })
  @SwaggerApiResponse({ status: 404, description: 'Address not found' })
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
  @ApiOperation({
    summary: 'Update address',
    description: 'Updates an existing address. Users can only update their own addresses.',
  })
  @ApiParam({ name: 'id', description: 'Address UUID', type: String })
  @ApiBody({ type: UpdateAddressDto })
  @SwaggerApiResponse({ status: 200, description: 'Address updated successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Cannot update this address' })
  @SwaggerApiResponse({ status: 404, description: 'Address not found' })
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
  @ApiOperation({
    summary: 'Delete address',
    description: 'Deletes an address. Users can only delete their own addresses.',
  })
  @ApiParam({ name: 'id', description: 'Address UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Address deleted successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Cannot delete this address' })
  @SwaggerApiResponse({ status: 404, description: 'Address not found' })
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
  @ApiOperation({
    summary: 'Set default address',
    description: 'Sets an address as the default shipping/billing address for the user.',
  })
  @ApiParam({ name: 'id', description: 'Address UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Default address updated successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Cannot set this address as default' })
  @SwaggerApiResponse({ status: 404, description: 'Address not found' })
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


