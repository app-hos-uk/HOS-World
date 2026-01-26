import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreateFulfillmentCenterDto,
  UpdateFulfillmentCenterDto,
} from './dto/create-fulfillment-center.dto';
import { VerifyShipmentDto, CreateShipmentDto } from './dto/verify-shipment.dto';
import { ShipmentStatus, ProductSubmissionStatus } from '@prisma/client';

@Injectable()
export class FulfillmentService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  // Fulfillment Center Management
  async createFulfillmentCenter(createDto: CreateFulfillmentCenterDto) {
    return this.prisma.fulfillmentCenter.create({
      data: createDto,
    });
  }

  async findAllFulfillmentCenters(activeOnly: boolean = false) {
    const where: any = {};
    if (activeOnly) {
      where.isActive = true;
    }

    return this.prisma.fulfillmentCenter.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        shipments: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async findOneFulfillmentCenter(id: string) {
    const center = await this.prisma.fulfillmentCenter.findUnique({
      where: { id },
      include: {
        shipments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!center) {
      throw new NotFoundException('Fulfillment center not found');
    }

    return center;
  }

  async updateFulfillmentCenter(id: string, updateDto: UpdateFulfillmentCenterDto) {
    const center = await this.prisma.fulfillmentCenter.findUnique({
      where: { id },
    });

    if (!center) {
      throw new NotFoundException('Fulfillment center not found');
    }

    // Build update data object with only defined values
    // This prevents undefined values from setting fields to null
    const updateData: Record<string, any> = {};
    
    if (updateDto.name !== undefined) updateData.name = updateDto.name;
    if (updateDto.address !== undefined) updateData.address = updateDto.address;
    if (updateDto.city !== undefined) updateData.city = updateDto.city;
    if (updateDto.country !== undefined) updateData.country = updateDto.country;
    if (updateDto.postalCode !== undefined) updateData.postalCode = updateDto.postalCode;
    if (updateDto.latitude !== undefined) updateData.latitude = updateDto.latitude;
    if (updateDto.longitude !== undefined) updateData.longitude = updateDto.longitude;
    if (updateDto.contactEmail !== undefined) updateData.contactEmail = updateDto.contactEmail;
    if (updateDto.contactPhone !== undefined) updateData.contactPhone = updateDto.contactPhone;
    if (updateDto.capacity !== undefined) updateData.capacity = updateDto.capacity;
    if (updateDto.isActive !== undefined) updateData.isActive = updateDto.isActive;

    return this.prisma.fulfillmentCenter.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteFulfillmentCenter(id: string) {
    const center = await this.prisma.fulfillmentCenter.findUnique({
      where: { id },
      include: {
        shipments: true,
      },
    });

    if (!center) {
      throw new NotFoundException('Fulfillment center not found');
    }

    if (center.shipments.length > 0) {
      throw new BadRequestException(
        'Cannot delete fulfillment center with existing shipments',
      );
    }

    await this.prisma.fulfillmentCenter.delete({
      where: { id },
    });

    return { message: 'Fulfillment center deleted successfully' };
  }

  // Shipment Management
  async createShipment(createDto: CreateShipmentDto) {
    // Verify submission exists and is approved
    const submission = await this.prisma.productSubmission.findUnique({
      where: { id: createDto.submissionId },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    if (submission.status !== 'PROCUREMENT_APPROVED') {
      throw new BadRequestException(
        'Shipment can only be created for procurement-approved submissions',
      );
    }

    // Check if shipment already exists
    const existingShipment = await this.prisma.shipment.findUnique({
      where: { submissionId: createDto.submissionId },
    });

    if (existingShipment) {
      throw new BadRequestException('Shipment already exists for this submission');
    }

    // Verify fulfillment center exists
    const fulfillmentCenter = await this.prisma.fulfillmentCenter.findUnique({
      where: { id: createDto.fulfillmentCenterId },
    });

    if (!fulfillmentCenter) {
      throw new NotFoundException('Fulfillment center not found');
    }

    // Create shipment
    const shipment = await this.prisma.shipment.create({
      data: {
        submissionId: createDto.submissionId,
        fulfillmentCenterId: createDto.fulfillmentCenterId,
        trackingNumber: createDto.trackingNumber,
        status: 'PENDING',
      },
      include: {
        submission: {
          include: {
            seller: {
              select: {
                id: true,
                storeName: true,
                slug: true,
              },
            },
          },
        },
        fulfillmentCenter: true,
      },
    });

    // Update submission status
    await this.prisma.productSubmission.update({
      where: { id: createDto.submissionId },
      data: {
        status: 'SHIPPED_TO_FC',
      },
    });

    // Send notification to fulfillment center staff
    try {
      const fcStaff = await this.prisma.user.findMany({
        where: {
          role: { in: ['FULFILLMENT', 'ADMIN'] },
        },
        select: { id: true, email: true },
      });

      for (const staff of fcStaff) {
        await this.prisma.notification.create({
          data: {
            userId: staff.id,
            type: 'ORDER_CONFIRMATION', // Using existing type, can be extended later
            subject: 'New Shipment Received',
            content: `New shipment ${shipment.trackingNumber || shipment.id} has been created for fulfillment center ${shipment.fulfillmentCenter?.name || 'N/A'}`,
            email: staff.email || undefined,
            metadata: {
              shipmentId: shipment.id,
              fulfillmentCenterId: shipment.fulfillmentCenterId,
            } as any,
          },
        });
      }
    } catch (error) {
      // Log error but don't fail the shipment creation
      console.error('Failed to send notification to fulfillment center:', error);
    }

    return shipment;
  }

  async findAllShipments(status?: ShipmentStatus, fulfillmentCenterId?: string) {
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (fulfillmentCenterId) {
      where.fulfillmentCenterId = fulfillmentCenterId;
    }

    const shipments = await this.prisma.shipment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        submission: {
          include: {
            seller: {
              select: {
                id: true,
                storeName: true,
                slug: true,
              },
            },
          },
        },
        fulfillmentCenter: true,
      },
    });

    return shipments;
  }

  async findOneShipment(id: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id },
      include: {
        submission: {
          include: {
            seller: {
              select: {
                id: true,
                storeName: true,
                slug: true,
                sellerType: true,
              },
            },
            // productData: true, // Field may not exist in schema - adjust based on actual schema
          },
        },
        fulfillmentCenter: true,
      },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    return shipment;
  }

  async verifyShipment(id: string, userId: string, verifyDto: VerifyShipmentDto) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id },
      include: {
        submission: true,
      },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    if (shipment.status === 'VERIFIED' || shipment.status === 'REJECTED') {
      throw new BadRequestException(
        `Shipment cannot be verified in status: ${shipment.status}`,
      );
    }

    const updateData: any = {
      status: verifyDto.status,
      verifiedBy: userId,
    };

    if (verifyDto.verificationNotes) {
      updateData.verificationNotes = verifyDto.verificationNotes;
    }

    if (verifyDto.trackingNumber) {
      updateData.trackingNumber = verifyDto.trackingNumber;
    }

    if (verifyDto.status === 'VERIFIED') {
      updateData.receivedAt = new Date();
    }

    const updated = await this.prisma.shipment.update({
      where: { id },
      data: updateData,
      include: {
        submission: {
          include: {
            seller: {
              select: {
                id: true,
                storeName: true,
                slug: true,
              },
            },
          },
        },
        fulfillmentCenter: true,
      },
    });

    // If verified, update submission status and notify teams
    if (verifyDto.status === 'VERIFIED') {
      await this.prisma.productSubmission.update({
        where: { id: shipment.submissionId },
        data: {
          status: 'FC_ACCEPTED',
          fcAcceptedAt: new Date(),
        },
      });

      // Send notifications to Procurement, Catalog, and Operations teams
      try {
        const teams = await this.prisma.user.findMany({
          where: {
            role: { in: ['PROCUREMENT', 'CATALOG', 'ADMIN'] },
          },
          select: { id: true, email: true, role: true },
        });

        for (const user of teams) {
          await this.prisma.notification.create({
            data: {
              userId: user.id,
              type: 'ORDER_CONFIRMATION', // Using existing type, can be extended with CATALOG_PENDING later
              subject: 'Shipment Verified - Ready for Catalog',
              content: `Shipment ${updated.trackingNumber || updated.id} has been verified and accepted at fulfillment center. Product submission is ready for catalog.`,
              email: user.email || undefined,
              metadata: {
                shipmentId: updated.id,
                submissionId: shipment.submissionId,
              } as any,
            },
          });
        }
      } catch (error) {
        console.error('Failed to send verification notifications:', error);
      }
    } else if (verifyDto.status === 'REJECTED') {
      await this.prisma.productSubmission.update({
        where: { id: shipment.submissionId },
        data: {
          status: 'FC_REJECTED',
        },
      });

      // Send notification to seller and procurement team
      try {
        // Notify seller
        if (shipment.submission?.sellerId) {
          const seller = await this.prisma.seller.findUnique({
            where: { id: shipment.submission.sellerId },
            select: { userId: true },
          });

          if (seller) {
            await this.prisma.notification.create({
              data: {
                userId: seller.userId,
                type: 'ORDER_CANCELLED', // Using existing type, can be extended later
                subject: 'Shipment Rejected',
                content: `Your shipment ${updated.trackingNumber || updated.id} has been rejected at the fulfillment center. Please review and resubmit.`,
                metadata: {
                  shipmentId: updated.id,
                  submissionId: shipment.submissionId,
                } as any,
              },
            });
          }
        }

        // Notify procurement team
        const procurementTeam = await this.prisma.user.findMany({
          where: {
            role: { in: ['PROCUREMENT', 'ADMIN'] },
          },
          select: { id: true, email: true },
        });

        for (const user of procurementTeam) {
          await this.prisma.notification.create({
            data: {
              userId: user.id,
              type: 'ORDER_CANCELLED', // Using existing type, can be extended later
              subject: 'Shipment Rejected - Action Required',
              content: `Shipment ${updated.trackingNumber || updated.id} has been rejected. Review required.`,
              email: user.email || undefined,
              metadata: {
                shipmentId: updated.id,
                submissionId: shipment.submissionId,
              } as any,
            },
          });
        }
      } catch (error) {
        console.error('Failed to send rejection notifications:', error);
      }
    }

    return updated;
  }

  async getDashboardStats(fulfillmentCenterId?: string) {
    const where: any = {};
    if (fulfillmentCenterId) {
      where.fulfillmentCenterId = fulfillmentCenterId;
    }

    const [
      totalShipments,
      pending,
      inTransit,
      received,
      verified,
      rejected,
    ] = await Promise.all([
      this.prisma.shipment.count({ where }),
      this.prisma.shipment.count({ where: { ...where, status: 'PENDING' } }),
      this.prisma.shipment.count({ where: { ...where, status: 'IN_TRANSIT' } }),
      this.prisma.shipment.count({ where: { ...where, status: 'RECEIVED' } }),
      this.prisma.shipment.count({ where: { ...where, status: 'VERIFIED' } }),
      this.prisma.shipment.count({ where: { ...where, status: 'REJECTED' } }),
    ]);

    return {
      totalShipments,
      pending,
      inTransit,
      received,
      verified,
      rejected,
    };
  }
}

