import { Injectable, NotFoundException, ForbiddenException, Logger, ConflictException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { GeocodingService } from '../inventory/geocoding.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import type { Address } from '@hos-marketplace/shared-types';
import { Prisma } from '@prisma/client';

@Injectable()
export class AddressesService {
  private readonly logger = new Logger(AddressesService.name);

  constructor(
    private prisma: PrismaService,
    private geocodingService: GeocodingService,
  ) {}

  async create(userId: string, createAddressDto: CreateAddressDto): Promise<Address> {
    // If this is set as default, unset all other defaults
    if (createAddressDto.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    // Prepare address data
    const addressData: any = {
      userId,
      ...createAddressDto,
      isDefault: createAddressDto.isDefault || false,
    };

    // If latitude/longitude not provided, try to geocode the address
    // Only geocode if BOTH are missing (use AND, not OR) to avoid overwriting partial coordinates
    // Use explicit undefined checks to handle 0 as a valid coordinate (equator/prime meridian)
    if (createAddressDto.latitude === undefined && createAddressDto.longitude === undefined) {
      try {
        const geocodeResult = await this.geocodingService.geocode({
          street: createAddressDto.street,
          city: createAddressDto.city,
          state: createAddressDto.state,
          postalCode: createAddressDto.postalCode,
          country: createAddressDto.country,
        });

        if (geocodeResult) {
          addressData.latitude = geocodeResult.latitude;
          addressData.longitude = geocodeResult.longitude;
          this.logger.log(
            `Auto-geocoded address for user ${userId}: ${geocodeResult.latitude}, ${geocodeResult.longitude} (confidence: ${geocodeResult.confidence})`,
          );
        }
      } catch (error) {
        this.logger.warn(`Failed to geocode address for user ${userId}: ${error.message}`);
        // Continue without geocoding - address will be saved without coordinates
      }
    }

    const address = await this.prisma.address.create({
      data: addressData,
    });

    return this.mapToAddressType(address);
  }

  async findAll(userId: string): Promise<Address[]> {
    const addresses = await this.prisma.address.findMany({
      where: {
        userId,
        // Soft-deleted addresses (still referenced by orders) stay hidden from the book
        NOT: { firstName: { startsWith: '__deleted__' } },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return addresses.map((addr) => this.mapToAddressType(addr));
  }

  async findOne(id: string, userId: string): Promise<Address> {
    const address = await this.prisma.address.findFirst({
      where: { id, userId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    return this.mapToAddressType(address);
  }

  async update(id: string, userId: string, updateAddressDto: UpdateAddressDto): Promise<Address> {
    const address = await this.prisma.address.findFirst({
      where: { id, userId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    // If setting as default, unset all other defaults
    if (updateAddressDto.isDefault === true) {
      await this.prisma.address.updateMany({
        where: {
          userId,
          id: { not: id },
        },
        data: { isDefault: false },
      });
    }

    // Prepare update data
    const updateData: any = { ...updateAddressDto };

    // Check if address fields changed and need re-geocoding
    const addressFieldsChanged =
      updateAddressDto.street !== undefined ||
      updateAddressDto.city !== undefined ||
      updateAddressDto.state !== undefined ||
      updateAddressDto.postalCode !== undefined ||
      updateAddressDto.country !== undefined;

    // If address fields changed and lat/long not explicitly provided, re-geocode
    if (
      addressFieldsChanged &&
      updateAddressDto.latitude === undefined &&
      updateAddressDto.longitude === undefined
    ) {
      try {
        // Use updated values or fall back to existing values
        const street = updateAddressDto.street ?? address.street;
        const city = updateAddressDto.city ?? address.city;
        const state = updateAddressDto.state ?? address.state ?? undefined;
        const postalCode = updateAddressDto.postalCode ?? address.postalCode;
        const country = updateAddressDto.country ?? address.country;

        const geocodeResult = await this.geocodingService.geocode({
          street,
          city,
          state,
          postalCode,
          country,
        });

        if (geocodeResult) {
          updateData.latitude = geocodeResult.latitude;
          updateData.longitude = geocodeResult.longitude;
          this.logger.log(
            `Auto-geocoded updated address ${id} for user ${userId}: ${geocodeResult.latitude}, ${geocodeResult.longitude} (confidence: ${geocodeResult.confidence})`,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Failed to geocode updated address ${id} for user ${userId}: ${error.message}`,
        );
        // Continue without geocoding
      }
    }

    const updated = await this.prisma.address.update({
      where: { id },
      data: updateData,
    });

    return this.mapToAddressType(updated);
  }

  async delete(id: string, userId: string): Promise<void> {
    const address = await this.prisma.address.findFirst({
      where: { id, userId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    // Orders retain FK references to shipping/billing addresses. If referenced,
    // anonymize the saved address instead of hard-deleting (avoids 500 FK errors).
    const orderRefs = await this.prisma.order.count({
      where: {
        OR: [{ shippingAddressId: id }, { billingAddressId: id }],
      },
    });

    if (orderRefs > 0) {
      await this.prisma.address.update({
        where: { id },
        data: {
          // Detach from the user's address book while preserving order history
          userId: address.userId,
          label: address.label ? `[Removed] ${address.label}` : '[Removed]',
          isDefault: false,
          // Soft-hide: mark with a sentinel firstName so list endpoints can filter
          firstName: address.firstName?.startsWith('__deleted__')
            ? address.firstName
            : `__deleted__${address.firstName || ''}`,
        },
      });
    } else {
      try {
        await this.prisma.address.delete({
          where: { id },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2003'
        ) {
          throw new ConflictException(
            'This address is linked to existing orders and cannot be permanently deleted. It has been removed from your address book.',
          );
        }
        throw err;
      }
    }

    // If this was the default address, set the most recent remaining as default
    if (address.isDefault) {
      const mostRecent = await this.prisma.address.findFirst({
        where: {
          userId,
          NOT: { firstName: { startsWith: '__deleted__' } },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (mostRecent) {
        await this.prisma.address.update({
          where: { id: mostRecent.id },
          data: { isDefault: true },
        });
      }
    }
  }

  async setDefault(id: string, userId: string): Promise<Address> {
    const address = await this.prisma.address.findFirst({
      where: { id, userId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    // Unset all other defaults
    await this.prisma.address.updateMany({
      where: {
        userId,
        id: { not: id },
      },
      data: { isDefault: false },
    });

    // Set this as default
    const updated = await this.prisma.address.update({
      where: { id },
      data: { isDefault: true },
    });

    return this.mapToAddressType(updated);
  }

  private mapToAddressType(address: any): Address {
    return {
      id: address.id,
      userId: address.userId,
      label: address.label || undefined,
      firstName: address.firstName,
      lastName: address.lastName,
      street: address.street,
      city: address.city,
      state: address.state || undefined,
      postalCode: address.postalCode,
      country: address.country,
      phone: address.phone || undefined,
      isDefault: address.isDefault,
      latitude: address.latitude ?? undefined,
      longitude: address.longitude ?? undefined,
    };
  }
}
