import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  ParseUUIDPipe,
Version,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { DomainsService } from './domains.service';
import {
  AssignCustomDomainDto,
  CreateSubDomainDto,
} from './dto/assign-domain.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('domains')
@Version('1')
@Controller('domains')
export class DomainsController {
  constructor(private readonly domainsService: DomainsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('WHOLESALER', 'B2C_SELLER', 'SELLER', 'ADMIN')
  @Get('sellers/:sellerId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get seller domains',
    description: 'Retrieves all domains (custom and subdomains) for a specific seller. Seller/Admin access required.',
  })
  @ApiParam({ name: 'sellerId', description: 'Seller UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Seller domains retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Seller/Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Seller not found' })
  async getSellerDomains(
    @Param('sellerId', ParseUUIDPipe) sellerId: string,
  ): Promise<ApiResponse<any>> {
    const domains = await this.domainsService.getSellerDomains(sellerId);
    return {
      data: domains,
      message: 'Seller domains retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('WHOLESALER', 'B2C_SELLER', 'SELLER', 'ADMIN')
  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get my domains',
    description: 'Retrieves all domains for the authenticated seller. Seller/Admin access required.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Domains retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Seller/Admin access required' })
  async getMyDomains(@Request() req: any): Promise<ApiResponse<any>> {
    const domains = await this.domainsService.getSellerDomainsByUserId(req.user.id);
    return {
      data: domains,
      message: 'Domains retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('sellers/:sellerId/custom-domain')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Assign custom domain (Admin only)',
    description: 'Assigns a custom domain to a seller. Admin access required.',
  })
  @ApiParam({ name: 'sellerId', description: 'Seller UUID', type: String })
  @ApiBody({ type: AssignCustomDomainDto })
  @SwaggerApiResponse({ status: 201, description: 'Custom domain assigned successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Seller not found' })
  async assignCustomDomain(
    @Param('sellerId', ParseUUIDPipe) sellerId: string,
    @Body() assignDto: AssignCustomDomainDto,
  ): Promise<ApiResponse<any>> {
    const seller = await this.domainsService.assignCustomDomain(sellerId, assignDto);
    return {
      data: seller,
      message: 'Custom domain assigned successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('WHOLESALER', 'B2C_SELLER', 'SELLER', 'ADMIN')
  @Post('sellers/:sellerId/subdomain')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create subdomain',
    description: 'Creates a subdomain for a seller. Seller/Admin access required.',
  })
  @ApiParam({ name: 'sellerId', description: 'Seller UUID', type: String })
  @ApiBody({ type: CreateSubDomainDto })
  @SwaggerApiResponse({ status: 201, description: 'Sub-domain created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Seller/Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Seller not found' })
  async createSubDomain(
    @Param('sellerId', ParseUUIDPipe) sellerId: string,
    @Body() createDto: CreateSubDomainDto,
  ): Promise<ApiResponse<any>> {
    const seller = await this.domainsService.createSubDomain(sellerId, createDto);
    return {
      data: seller,
      message: 'Sub-domain created successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete('sellers/:sellerId/custom-domain')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Remove custom domain (Admin only)',
    description: 'Removes a custom domain from a seller. Admin access required.',
  })
  @ApiParam({ name: 'sellerId', description: 'Seller UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Custom domain removed successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Seller or domain not found' })
  async removeCustomDomain(
    @Param('sellerId', ParseUUIDPipe) sellerId: string,
  ): Promise<ApiResponse<any>> {
    const seller = await this.domainsService.removeCustomDomain(sellerId);
    return {
      data: seller,
      message: 'Custom domain removed successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('WHOLESALER', 'B2C_SELLER', 'SELLER', 'ADMIN')
  @Delete('sellers/:sellerId/subdomain')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Remove subdomain',
    description: 'Removes a subdomain from a seller. Seller/Admin access required.',
  })
  @ApiParam({ name: 'sellerId', description: 'Seller UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Sub-domain removed successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Seller/Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Seller or subdomain not found' })
  async removeSubDomain(
    @Param('sellerId', ParseUUIDPipe) sellerId: string,
  ): Promise<ApiResponse<any>> {
    const seller = await this.domainsService.removeSubDomain(sellerId);
    return {
      data: seller,
      message: 'Sub-domain removed successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('WHOLESALER', 'B2C_SELLER', 'SELLER', 'ADMIN')
  @Get('packages')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get domain packages',
    description: 'Retrieves available domain packages for sellers. Seller/Admin access required.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Domain packages retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Seller/Admin access required' })
  async getDomainPackages(): Promise<ApiResponse<any[]>> {
    const packages = await this.domainsService.getDomainPackages();
    return {
      data: packages,
      message: 'Domain packages retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('WHOLESALER', 'B2C_SELLER', 'SELLER', 'ADMIN')
  @Get('sellers/:sellerId/dns-config')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get DNS configuration',
    description: 'Retrieves DNS configuration for a seller\'s custom domain. Seller/Admin access required.',
  })
  @ApiParam({ name: 'sellerId', description: 'Seller UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'DNS configuration retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Seller/Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Seller not found' })
  async getDNSConfiguration(
    @Param('sellerId', ParseUUIDPipe) sellerId: string,
  ): Promise<ApiResponse<any>> {
    const config = await this.domainsService.getDNSConfiguration(sellerId);
    return {
      data: config,
      message: 'DNS configuration retrieved successfully',
    };
  }
}

