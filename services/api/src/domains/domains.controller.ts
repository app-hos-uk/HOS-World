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
} from '@nestjs/common';
import { DomainsService } from './domains.service';
import {
  AssignCustomDomainDto,
  CreateSubDomainDto,
} from './dto/assign-domain.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Controller('domains')
export class DomainsController {
  constructor(private readonly domainsService: DomainsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('WHOLESALER', 'B2C_SELLER', 'SELLER', 'ADMIN')
  @Get('sellers/:sellerId')
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

