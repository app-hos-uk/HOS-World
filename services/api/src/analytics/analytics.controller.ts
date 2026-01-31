import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  Request,
  Res,
  ParseBoolPipe,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Response } from 'express';
import { AnalyticsService, AnalyticsFilters } from './analytics.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';
// @ts-ignore - exceljs types may not be available
import * as ExcelJS from 'exceljs';
// @ts-ignore - pdfkit types may not be available
import PDFDocument from 'pdfkit';

@ApiTags('analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
@Roles('ADMIN', 'SELLER', 'B2C_SELLER', 'WHOLESALER')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('sales/trends')
  @ApiOperation({
    summary: 'Get sales trends',
    description: 'Retrieves sales trends with growth calculations and period comparisons.',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date (ISO format)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date (ISO format)',
  })
  @ApiQuery({ name: 'sellerId', required: false, type: String, description: 'Filter by seller ID' })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['daily', 'weekly', 'monthly', 'yearly'],
    description: 'Grouping period',
  })
  @ApiQuery({
    name: 'compareWithPrevious',
    required: false,
    type: Boolean,
    description: 'Compare with previous period',
  })
  @SwaggerApiResponse({ status: 200, description: 'Sales trends retrieved successfully' })
  async getSalesTrends(
    @Request() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('sellerId') sellerId?: string,
    @Query('period') period?: 'daily' | 'weekly' | 'monthly' | 'yearly',
    @Query('compareWithPrevious', new DefaultValuePipe(false), ParseBoolPipe)
    compareWithPrevious?: boolean,
  ): Promise<ApiResponse<any>> {
    const filters: AnalyticsFilters = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      sellerId: sellerId || (req.user.role !== 'ADMIN' ? req.user.id : undefined),
      period: period || 'monthly',
      compareWithPrevious,
    };

    const data = await this.analyticsService.getSalesTrends(filters);

    return {
      data,
      message: 'Sales trends retrieved successfully',
    };
  }

  @Get('customers/metrics')
  @ApiOperation({
    summary: 'Get customer metrics',
    description: 'Retrieves customer analytics including retention rate and lifetime value.',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date (ISO format)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date (ISO format)',
  })
  @SwaggerApiResponse({ status: 200, description: 'Customer metrics retrieved successfully' })
  async getCustomerMetrics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<ApiResponse<any>> {
    const filters: AnalyticsFilters = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    const data = await this.analyticsService.getCustomerMetrics(filters);

    return {
      data,
      message: 'Customer metrics retrieved successfully',
    };
  }

  @Get('products/performance')
  @ApiOperation({
    summary: 'Get product performance',
    description: 'Retrieves product performance metrics including revenue and conversion rates.',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date (ISO format)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date (ISO format)',
  })
  @ApiQuery({ name: 'sellerId', required: false, type: String, description: 'Filter by seller ID' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Limit results (default: 20)',
  })
  @SwaggerApiResponse({ status: 200, description: 'Product performance retrieved successfully' })
  async getProductPerformance(
    @Request() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('sellerId') sellerId?: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ): Promise<ApiResponse<any>> {
    const filters: AnalyticsFilters = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      sellerId: sellerId || (req.user.role !== 'ADMIN' ? req.user.id : undefined),
    };

    const data = await this.analyticsService.getProductPerformance(filters, limit);

    return {
      data,
      message: 'Product performance retrieved successfully',
    };
  }

  @Get('inventory/metrics')
  @ApiOperation({
    summary: 'Get inventory metrics',
    description: 'Retrieves inventory metrics including turnover rates and stock levels.',
  })
  @ApiQuery({
    name: 'warehouseId',
    required: false,
    type: String,
    description: 'Filter by warehouse ID',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date for turnover calculation (ISO format)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date for turnover calculation (ISO format)',
  })
  @SwaggerApiResponse({ status: 200, description: 'Inventory metrics retrieved successfully' })
  async getInventoryMetrics(
    @Query('warehouseId') warehouseId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<ApiResponse<any>> {
    const filters: AnalyticsFilters = {
      warehouseId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    const data = await this.analyticsService.getInventoryMetrics(filters);

    return {
      data,
      message: 'Inventory metrics retrieved successfully',
    };
  }

  @Get('revenue/growth')
  @ApiOperation({
    summary: 'Get revenue growth',
    description:
      'Retrieves revenue growth rate comparing current period with previous period (MoM or YoY).',
  })
  @ApiQuery({
    name: 'startDate',
    required: true,
    type: String,
    description: 'Start date (ISO format)',
  })
  @ApiQuery({ name: 'endDate', required: true, type: String, description: 'End date (ISO format)' })
  @ApiQuery({
    name: 'comparisonType',
    required: false,
    enum: ['month', 'year'],
    description: 'Comparison type (default: month)',
  })
  @SwaggerApiResponse({ status: 200, description: 'Revenue growth retrieved successfully' })
  async getRevenueGrowth(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('comparisonType') comparisonType: 'month' | 'year' = 'month',
  ): Promise<ApiResponse<any>> {
    const data = await this.analyticsService.getRevenueGrowth(
      new Date(startDate),
      new Date(endDate),
      comparisonType,
    );

    return {
      data,
      message: 'Revenue growth retrieved successfully',
    };
  }

  @Get('export/:format')
  @ApiOperation({
    summary: 'Export analytics data',
    description: 'Exports analytics data in CSV, Excel, or PDF format.',
  })
  @ApiQuery({
    name: 'reportType',
    required: true,
    enum: ['sales', 'customers', 'products', 'inventory'],
    description: 'Type of report',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date (ISO format)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date (ISO format)',
  })
  @SwaggerApiResponse({ status: 200, description: 'Export file generated successfully' })
  async exportAnalytics(
    @Request() req: any,
    @Res() res: Response,
    @Query('reportType') reportType: 'sales' | 'customers' | 'products' | 'inventory',
    @Query('format') format: 'csv' | 'xlsx' | 'pdf',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const filters: AnalyticsFilters = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      sellerId: req.user.role !== 'ADMIN' ? req.user.id : undefined,
    };

    let data: any;
    let filename: string;

    switch (reportType) {
      case 'sales':
        data = await this.analyticsService.getSalesTrends(filters);
        filename = `sales-report-${Date.now()}`;
        break;
      case 'customers':
        data = await this.analyticsService.getCustomerMetrics(filters);
        filename = `customers-report-${Date.now()}`;
        break;
      case 'products':
        data = await this.analyticsService.getProductPerformance(filters, 100);
        filename = `products-report-${Date.now()}`;
        break;
      case 'inventory':
        data = await this.analyticsService.getInventoryMetrics(filters);
        filename = `inventory-report-${Date.now()}`;
        break;
    }

    switch (format) {
      case 'csv':
        return this.exportCSV(res, data, filename, reportType);
      case 'xlsx':
        return this.exportExcel(res, data, filename, reportType);
      case 'pdf':
        return this.exportPDF(res, data, filename, reportType);
    }
  }

  private async exportCSV(res: Response, data: any, filename: string, reportType: string) {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);

    let csv = '';

    switch (reportType) {
      case 'sales':
        csv = 'Period,Revenue,Orders,Average Order Value,Growth\n';
        if (data.trends) {
          data.trends.forEach((trend: any) => {
            csv += `${trend.period},${trend.revenue},${trend.orders},${trend.averageOrderValue},${trend.growth || ''}\n`;
          });
        }
        break;
      case 'products':
        csv = 'Product ID,Name,SKU,Revenue,Orders,Quantity,Average Price\n';
        if (Array.isArray(data)) {
          data.forEach((product: any) => {
            csv += `${product.productId},${product.name},${product.sku},${product.revenue},${product.orders},${product.quantity},${product.averagePrice}\n`;
          });
        }
        break;
      case 'customers':
        csv = 'Metric,Value\n';
        csv += `Total Customers,${data.totalCustomers}\n`;
        csv += `New Customers,${data.newCustomers}\n`;
        csv += `Returning Customers,${data.returningCustomers}\n`;
        csv += `Retention Rate,${data.retentionRate}%\n`;
        csv += `Average LTV,${data.averageLTV}\n`;
        csv += `Average Order Frequency,${data.averageOrderFrequency}\n`;
        csv += `Churn Rate,${data.churnRate}%\n`;
        break;
      case 'inventory':
        csv = 'Metric,Value\n';
        csv += `Total Value,${data.totalValue}\n`;
        csv += `Total Quantity,${data.totalQuantity}\n`;
        csv += `Warehouse Count,${data.warehouseCount}\n`;
        csv += `Low Stock Items,${data.lowStockItems}\n`;
        csv += `Turnover Rate,${data.turnoverRate}\n`;
        csv += `Average Days in Stock,${data.averageDaysInStock}\n`;
        break;
    }

    res.send(csv);
  }

  private async exportExcel(res: Response, data: any, filename: string, reportType: string) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Report');

    switch (reportType) {
      case 'sales':
        worksheet.columns = [
          { header: 'Period', key: 'period', width: 15 },
          { header: 'Revenue', key: 'revenue', width: 15 },
          { header: 'Orders', key: 'orders', width: 10 },
          { header: 'Average Order Value', key: 'averageOrderValue', width: 20 },
          { header: 'Growth %', key: 'growth', width: 15 },
        ];
        if (data.trends) {
          data.trends.forEach((trend: any) => {
            worksheet.addRow({
              period: trend.period,
              revenue: trend.revenue,
              orders: trend.orders,
              averageOrderValue: trend.averageOrderValue,
              growth: trend.growth || '',
            });
          });
        }
        break;
      case 'products':
        worksheet.columns = [
          { header: 'Product ID', key: 'productId', width: 20 },
          { header: 'Name', key: 'name', width: 30 },
          { header: 'SKU', key: 'sku', width: 15 },
          { header: 'Revenue', key: 'revenue', width: 15 },
          { header: 'Orders', key: 'orders', width: 10 },
          { header: 'Quantity', key: 'quantity', width: 10 },
          { header: 'Average Price', key: 'averagePrice', width: 15 },
        ];
        if (Array.isArray(data)) {
          data.forEach((product: any) => {
            worksheet.addRow(product);
          });
        }
        break;
      case 'customers':
        worksheet.columns = [
          { header: 'Metric', key: 'metric', width: 25 },
          { header: 'Value', key: 'value', width: 15 },
        ];
        worksheet.addRow({ metric: 'Total Customers', value: data.totalCustomers });
        worksheet.addRow({ metric: 'New Customers', value: data.newCustomers });
        worksheet.addRow({ metric: 'Returning Customers', value: data.returningCustomers });
        worksheet.addRow({ metric: 'Retention Rate', value: `${data.retentionRate}%` });
        worksheet.addRow({ metric: 'Average LTV', value: data.averageLTV });
        worksheet.addRow({ metric: 'Average Order Frequency', value: data.averageOrderFrequency });
        worksheet.addRow({ metric: 'Churn Rate', value: `${data.churnRate}%` });
        break;
      case 'inventory':
        worksheet.columns = [
          { header: 'Metric', key: 'metric', width: 25 },
          { header: 'Value', key: 'value', width: 15 },
        ];
        worksheet.addRow({ metric: 'Total Value', value: data.totalValue });
        worksheet.addRow({ metric: 'Total Quantity', value: data.totalQuantity });
        worksheet.addRow({ metric: 'Warehouse Count', value: data.warehouseCount });
        worksheet.addRow({ metric: 'Low Stock Items', value: data.lowStockItems });
        worksheet.addRow({ metric: 'Turnover Rate', value: data.turnoverRate });
        worksheet.addRow({ metric: 'Average Days in Stock', value: data.averageDaysInStock });
        break;
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  }

  private async exportPDF(res: Response, data: any, filename: string, reportType: string) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    doc.fontSize(20).text(`${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`, {
      align: 'center',
    });
    doc.moveDown();

    doc.fontSize(12);
    doc.text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(2);

    switch (reportType) {
      case 'sales':
        if (data.trends) {
          doc.fontSize(14).text('Sales Trends', { underline: true });
          doc.moveDown();
          data.trends.forEach((trend: any) => {
            doc.fontSize(10);
            doc.text(
              `${trend.period}: Revenue £${trend.revenue}, Orders ${trend.orders}, AOV £${trend.averageOrderValue}${trend.growth ? ` (Growth: ${trend.growth.toFixed(2)}%)` : ''}`,
            );
            doc.moveDown(0.5);
          });
        }
        break;
      case 'products':
        if (Array.isArray(data)) {
          doc.fontSize(14).text('Product Performance', { underline: true });
          doc.moveDown();
          data.slice(0, 50).forEach((product: any) => {
            doc.fontSize(10);
            doc.text(
              `${product.name} (${product.sku}): Revenue £${product.revenue}, Orders ${product.orders}, Quantity ${product.quantity}`,
            );
            doc.moveDown(0.5);
          });
        }
        break;
      case 'customers':
        doc.fontSize(14).text('Customer Metrics', { underline: true });
        doc.moveDown();
        doc.fontSize(10);
        doc.text(`Total Customers: ${data.totalCustomers}`);
        doc.text(`New Customers: ${data.newCustomers}`);
        doc.text(`Returning Customers: ${data.returningCustomers}`);
        doc.text(`Retention Rate: ${data.retentionRate}%`);
        doc.text(`Average LTV: £${data.averageLTV}`);
        doc.text(`Average Order Frequency: ${data.averageOrderFrequency}`);
        doc.text(`Churn Rate: ${data.churnRate}%`);
        break;
      case 'inventory':
        doc.fontSize(14).text('Inventory Metrics', { underline: true });
        doc.moveDown();
        doc.fontSize(10);
        doc.text(`Total Value: £${data.totalValue}`);
        doc.text(`Total Quantity: ${data.totalQuantity}`);
        doc.text(`Warehouse Count: ${data.warehouseCount}`);
        doc.text(`Low Stock Items: ${data.lowStockItems}`);
        doc.text(`Turnover Rate: ${data.turnoverRate}`);
        doc.text(`Average Days in Stock: ${data.averageDaysInStock}`);
        break;
    }

    doc.end();
  }
}
