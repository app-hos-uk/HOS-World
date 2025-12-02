import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import type { Address } from '@hos-marketplace/shared-types';

@Injectable()
export class AddressesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createAddressDto: CreateAddressDto): Promise<Address> {
    // If this is set as default, unset all other defaults
    if (createAddressDto.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    const address = await this.prisma.address.create({
      data: {
        userId,
        ...createAddressDto,
        isDefault: createAddressDto.isDefault || false,
      },
    });

    return this.mapToAddressType(address);
  }

  async findAll(userId: string): Promise<Address[]> {
    const addresses = await this.prisma.address.findMany({
      where: { userId },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
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

    const updated = await this.prisma.address.update({
      where: { id },
      data: updateAddressDto,
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

    await this.prisma.address.delete({
      where: { id },
    });

    // If this was the default address, set the most recent as default
    if (address.isDefault) {
      const mostRecent = await this.prisma.address.findFirst({
        where: { userId },
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
    };
  }
}


