import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { TaxService } from './tax.service';
import { CreateTaxZoneDto } from './dto/create-tax-zone.dto';
import { CreateTaxClassDto } from './dto/create-tax-class.dto';
import { CreateTaxRateDto } from './dto/create-tax-rate.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('tax')
@Controller('tax')
export class TaxController {
  constructor(private readonly taxService: TaxService) {}

  // --- Tax Zones ---

  @Post('zones')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create tax zone',
    description: 'Creates a new tax zone. Requires ADMIN role.',
  })
  @SwaggerApiResponse({ status: 201, description: 'Tax zone created successfully' })
  async createTaxZone(
    @Body() createDto: CreateTaxZoneDto,
  ): Promise<ApiResponse<any>> {
    const zone = await this.taxService.createTaxZone(createDto);
    return {
      data: zone,
      message: 'Tax zone created successfully',
    };
  }

  @Get('zones')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SELLER', 'B2C_SELLER')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get all tax zones',
    description: 'Retrieves all tax zones.',
  })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  @SwaggerApiResponse({ status: 200, description: 'Tax zones retrieved successfully' })
  async findAllTaxZones(
    @Query('includeInactive') includeInactive?: string,
  ): Promise<ApiResponse<any[]>> {
    const zones = await this.taxService.findAllTaxZones(
      includeInactive === 'true',
    );
    return {
      data: zones,
      message: 'Tax zones retrieved successfully',
    };
  }

  @Get('zones/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SELLER', 'B2C_SELLER')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get tax zone by ID',
    description: 'Retrieves a specific tax zone by ID.',
  })
  @ApiParam({ name: 'id', description: 'Tax zone UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Tax zone retrieved successfully' })
  async findTaxZoneById(
    @Param('id') id: string,
  ): Promise<ApiResponse<any>> {
    const zone = await this.taxService.findTaxZoneById(id);
    return {
      data: zone,
      message: 'Tax zone retrieved successfully',
    };
  }

  @Put('zones/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update tax zone',
    description: 'Updates an existing tax zone.',
  })
  @ApiParam({ name: 'id', description: 'Tax zone UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Tax zone updated successfully' })
  async updateTaxZone(
    @Param('id') id: string,
    @Body() updateDto: Partial<CreateTaxZoneDto>,
  ): Promise<ApiResponse<any>> {
    const zone = await this.taxService.updateTaxZone(id, updateDto);
    return {
      data: zone,
      message: 'Tax zone updated successfully',
    };
  }

  @Delete('zones/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Delete tax zone',
    description: 'Deletes a tax zone.',
  })
  @ApiParam({ name: 'id', description: 'Tax zone UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Tax zone deleted successfully' })
  async deleteTaxZone(@Param('id') id: string): Promise<ApiResponse<any>> {
    await this.taxService.deleteTaxZone(id);
    return {
      data: null,
      message: 'Tax zone deleted successfully',
    };
  }

  // --- Tax Classes ---

  @Post('classes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create tax class',
    description: 'Creates a new tax class. Requires ADMIN role.',
  })
  @SwaggerApiResponse({ status: 201, description: 'Tax class created successfully' })
  async createTaxClass(
    @Body() createDto: CreateTaxClassDto,
  ): Promise<ApiResponse<any>> {
    const taxClass = await this.taxService.createTaxClass(createDto);
    return {
      data: taxClass,
      message: 'Tax class created successfully',
    };
  }

  @Get('classes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SELLER', 'B2C_SELLER')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get all tax classes',
    description: 'Retrieves all tax classes.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Tax classes retrieved successfully' })
  async findAllTaxClasses(): Promise<ApiResponse<any[]>> {
    const classes = await this.taxService.findAllTaxClasses();
    return {
      data: classes,
      message: 'Tax classes retrieved successfully',
    };
  }

  @Get('classes/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SELLER', 'B2C_SELLER')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get tax class by ID',
    description: 'Retrieves a specific tax class by ID.',
  })
  @ApiParam({ name: 'id', description: 'Tax class UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Tax class retrieved successfully' })
  async findTaxClassById(
    @Param('id') id: string,
  ): Promise<ApiResponse<any>> {
    const taxClass = await this.taxService.findTaxClassById(id);
    return {
      data: taxClass,
      message: 'Tax class retrieved successfully',
    };
  }

  @Put('classes/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update tax class',
    description: 'Updates an existing tax class.',
  })
  @ApiParam({ name: 'id', description: 'Tax class UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Tax class updated successfully' })
  async updateTaxClass(
    @Param('id') id: string,
    @Body() updateDto: Partial<CreateTaxClassDto>,
  ): Promise<ApiResponse<any>> {
    const taxClass = await this.taxService.updateTaxClass(id, updateDto);
    return {
      data: taxClass,
      message: 'Tax class updated successfully',
    };
  }

  @Delete('classes/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Delete tax class',
    description: 'Deletes a tax class.',
  })
  @ApiParam({ name: 'id', description: 'Tax class UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Tax class deleted successfully' })
  async deleteTaxClass(@Param('id') id: string): Promise<ApiResponse<any>> {
    await this.taxService.deleteTaxClass(id);
    return {
      data: null,
      message: 'Tax class deleted successfully',
    };
  }

  // --- Tax Rates ---

  @Get('rates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SELLER', 'B2C_SELLER')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get tax rates',
    description: 'Retrieves tax rates with optional filters.',
  })
  @ApiQuery({ name: 'taxZoneId', required: false, type: String, description: 'Filter by tax zone ID' })
  @ApiQuery({ name: 'taxClassId', required: false, type: String, description: 'Filter by tax class ID' })
  @SwaggerApiResponse({ status: 200, description: 'Tax rates retrieved successfully' })
  async findAllTaxRates(
    @Query('taxZoneId') taxZoneId?: string,
    @Query('taxClassId') taxClassId?: string,
  ): Promise<ApiResponse<any[]>> {
    const rates = await this.taxService.findAllTaxRates(taxZoneId, taxClassId);
    return {
      data: rates,
      message: 'Tax rates retrieved successfully',
    };
  }

  @Get('rates/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SELLER', 'B2C_SELLER')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get tax rate by ID',
    description: 'Retrieves a specific tax rate by ID.',
  })
  @ApiParam({ name: 'id', description: 'Tax rate UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Tax rate retrieved successfully' })
  async findTaxRateById(@Param('id') id: string): Promise<ApiResponse<any>> {
    const rate = await this.taxService.findTaxRateById(id);
    return {
      data: rate,
      message: 'Tax rate retrieved successfully',
    };
  }

  @Post('rates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create tax rate',
    description: 'Creates a new tax rate for a zone and class combination.',
  })
  @SwaggerApiResponse({ status: 201, description: 'Tax rate created successfully' })
  async createTaxRate(
    @Body() createDto: CreateTaxRateDto,
  ): Promise<ApiResponse<any>> {
    const rate = await this.taxService.createTaxRate(createDto);
    return {
      data: rate,
      message: 'Tax rate created successfully',
    };
  }

  @Put('rates/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update tax rate',
    description: 'Updates an existing tax rate.',
  })
  @ApiParam({ name: 'id', description: 'Tax rate UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Tax rate updated successfully' })
  async updateTaxRate(
    @Param('id') id: string,
    @Body() updateDto: Partial<CreateTaxRateDto>,
  ): Promise<ApiResponse<any>> {
    const rate = await this.taxService.updateTaxRate(id, updateDto);
    return {
      data: rate,
      message: 'Tax rate updated successfully',
    };
  }

  @Delete('rates/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Delete tax rate',
    description: 'Deletes a tax rate.',
  })
  @ApiParam({ name: 'id', description: 'Tax rate UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Tax rate deleted successfully' })
  async deleteTaxRate(@Param('id') id: string): Promise<ApiResponse<any>> {
    await this.taxService.deleteTaxRate(id);
    return {
      data: null,
      message: 'Tax rate deleted successfully',
    };
  }

  // --- Tax Calculation ---

  @Post('calculate')
  @Public()
  @ApiOperation({
    summary: 'Calculate tax',
    description: 'Calculates tax for a given amount, tax class, and location. Public endpoint.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Tax calculated successfully' })
  async calculateTax(
    @Body() body: {
      amount: number;
      taxClassId: string;
      location: {
        country: string;
        state?: string;
        city?: string;
        postalCode?: string;
      };
    },
  ): Promise<ApiResponse<any>> {
    const result = await this.taxService.calculateTax(
      body.amount,
      body.taxClassId,
      body.location,
    );
    return {
      data: result,
      message: 'Tax calculated successfully',
    };
  }
}
