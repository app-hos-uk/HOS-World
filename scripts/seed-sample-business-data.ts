/**
 * Sample Business Data Seeding Script
 * 
 * This script creates sample data for testing business operations workflows:
 * - Product submissions in various states
 * - Sample sellers and users
 * - Test data for all dashboards
 * 
 * Usage:
 * 1. Run via Railway CLI: railway run pnpm ts-node scripts/seed-sample-business-data.ts
 * 2. Or via API endpoint (if created): POST /api/admin/seed-sample-data
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const SAMPLE_PASSWORDS = {
  seller: 'Test123!',
  wholesaler: 'Test123!',
  customer: 'Test123!',
};

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function seedSampleData() {
  console.log('🌱 Starting sample data seeding...');

  try {
    // 1. Create or get test sellers
    console.log('📦 Creating test sellers...');
    
    const sellerUser = await prisma.user.upsert({
      where: { email: 'seller-test@hos.test' },
      update: {},
      create: {
        email: 'seller-test@hos.test',
        password: await hashPassword(SAMPLE_PASSWORDS.seller),
        role: 'SELLER',
        firstName: 'Test',
        lastName: 'Seller',
        sellerProfile: {
          create: {
            storeName: 'Test Seller Store',
            slug: 'test-seller-store',
            sellerType: 'B2C_SELLER',
            isActive: true,
          },
        },
      },
      include: { sellerProfile: true },
    });

    const wholesalerUser = await prisma.user.upsert({
      where: { email: 'wholesaler-test@hos.test' },
      update: {},
      create: {
        email: 'wholesaler-test@hos.test',
        password: await hashPassword(SAMPLE_PASSWORDS.wholesaler),
        role: 'WHOLESALER',
        firstName: 'Test',
        lastName: 'Wholesaler',
        sellerProfile: {
          create: {
            storeName: 'Test Wholesaler Store',
            slug: 'test-wholesaler-store',
            sellerType: 'WHOLESALER',
            isActive: true,
          },
        },
      },
      include: { sellerProfile: true },
    });

    console.log('✅ Sellers created');

    // 2. Create sample product submissions in various states
    console.log('📝 Creating product submissions...');

    const submission1 = await prisma.productSubmission.create({
      data: {
        sellerId: sellerUser.sellerProfile!.id,
        productData: {
          name: 'Harry Potter Wand Replica',
          description: 'Authentic replica of Harry Potter\'s wand from the movies. Made from high-quality materials.',
          sku: 'HP-WAND-001',
          barcode: '1234567890123',
          ean: '1234567890123',
          price: 29.99,
          tradePrice: 20.00,
          rrp: 39.99,
          currency: 'USD',
          stock: 100,
          quantity: 50,
          fandom: 'harry-potter',
          category: 'Collectibles',
          tags: ['wand', 'harry-potter', 'collectible', 'replica'],
          images: [
            { url: 'https://via.placeholder.com/500x500?text=Wand+1', alt: 'Wand front view' },
            { url: 'https://via.placeholder.com/500x500?text=Wand+2', alt: 'Wand side view' },
          ],
        },
        status: 'SUBMITTED',
      },
    });

    const submission2 = await prisma.productSubmission.create({
      data: {
        sellerId: sellerUser.sellerProfile!.id,
        productData: {
          name: 'Marvel Avengers T-Shirt',
          description: 'Official Marvel Avengers t-shirt with logo. 100% cotton, comfortable fit.',
          sku: 'MARVEL-TEE-001',
          barcode: '1234567890124',
          price: 24.99,
          currency: 'USD',
          stock: 200,
          fandom: 'marvel',
          category: 'Apparel',
          tags: ['t-shirt', 'marvel', 'avengers', 'apparel'],
          images: [
            { url: 'https://via.placeholder.com/500x500?text=T-Shirt', alt: 'Avengers T-Shirt' },
          ],
        },
        status: 'UNDER_REVIEW',
        procurementNotes: 'Reviewing pricing and quality specifications.',
      },
    });

    const submission3 = await prisma.productSubmission.create({
      data: {
        sellerId: wholesalerUser.sellerProfile!.id,
        productData: {
          name: 'Star Wars Lightsaber Toy',
          description: 'Electronic lightsaber toy with sound effects and light-up blade.',
          sku: 'SW-LS-001',
          barcode: '1234567890125',
          price: 49.99,
          tradePrice: 35.00,
          rrp: 59.99,
          currency: 'USD',
          stock: 150,
          quantity: 100,
          fandom: 'star-wars',
          category: 'Toys',
          tags: ['lightsaber', 'star-wars', 'toy', 'electronic'],
          images: [
            { url: 'https://via.placeholder.com/500x500?text=Lightsaber', alt: 'Lightsaber toy' },
          ],
        },
        status: 'PROCUREMENT_APPROVED',
        selectedQuantity: 100,
        procurementApprovedAt: new Date(),
        procurementNotes: 'Approved for bulk order. Good quality product.',
      },
    });

    const submission4 = await prisma.productSubmission.create({
      data: {
        sellerId: sellerUser.sellerProfile!.id,
        productData: {
          name: 'Game of Thrones House Sigil Pin',
          description: 'Collectible pin featuring House Stark sigil. Metal construction.',
          sku: 'GOT-PIN-001',
          barcode: '1234567890126',
          price: 12.99,
          currency: 'USD',
          stock: 75,
          fandom: 'game-of-thrones',
          category: 'Accessories',
          tags: ['pin', 'game-of-thrones', 'collectible', 'accessory'],
          images: [
            { url: 'https://via.placeholder.com/500x500?text=Pin', alt: 'House Sigil Pin' },
          ],
        },
        status: 'PROCUREMENT_REJECTED',
        procurementNotes: 'Rejected: Pricing too high for market. Please revise.',
      },
    });

    console.log('✅ Product submissions created');

    // 3. Create fulfillment center and shipment for approved submission
    console.log('🚚 Creating fulfillment data...');

    const fulfillmentCenter = await prisma.fulfillmentCenter.upsert({
      where: { id: 'sample-fc-001' },
      update: {},
      create: {
        id: 'sample-fc-001',
        name: 'Main Fulfillment Center',
        address: '123 Warehouse St',
        city: 'London',
        country: 'UK',
        isActive: true,
      },
    });

    const shipment = await prisma.shipment.create({
      data: {
        submissionId: submission3.id,
        fulfillmentCenterId: fulfillmentCenter.id,
        status: 'PENDING',
        trackingNumber: 'TRACK-001',
      },
    });

    console.log('✅ Fulfillment data created');

    // 4. Create catalog entry for approved submission
    console.log('📚 Creating catalog entry...');

    const catalogEntry = await prisma.catalogEntry.create({
      data: {
        submissionId: submission3.id,
        title: 'Star Wars Lightsaber Toy - Electronic with Sound',
        description: 'Experience the power of the Force with this electronic lightsaber toy. Features authentic sound effects and a light-up blade that extends and retracts. Perfect for Star Wars fans of all ages.',
        keywords: ['lightsaber', 'star-wars', 'toy', 'electronic', 'sound', 'light-up'],
        images: [
          'https://via.placeholder.com/500x500?text=Lightsaber+1',
          'https://via.placeholder.com/500x500?text=Lightsaber+2',
        ],
        completedAt: new Date(),
      },
    });

    console.log('✅ Catalog entry created');

    // 5. Create marketing material
    console.log('📢 Creating marketing material...');

    const marketingMaterial = await prisma.marketingMaterial.create({
      data: {
        submissionId: submission3.id,
        type: 'BANNER',
        url: 'https://via.placeholder.com/1200x400?text=Star+Wars+Banner',
      },
    });

    console.log('✅ Marketing material created');

    // 6. Create product pricing
    console.log('💰 Creating product pricing...');

    const productPricing = await prisma.productPricing.create({
      data: {
        submissionId: submission3.id,
        margin: 15.5,
        visibilityLevel: 'STANDARD',
        financeNotes: 'Standard pricing approved. Good margin for platform.',
        financeApprovedAt: new Date(),
      },
    });

    console.log('✅ Product pricing created');

    // 7. Create sample orders (if order system exists)
    console.log('🛒 Creating sample orders...');

    const customerUser = await prisma.user.upsert({
      where: { email: 'customer-test@hos.test' },
      update: {},
      create: {
        email: 'customer-test@hos.test',
        password: await hashPassword(SAMPLE_PASSWORDS.customer),
        role: 'CUSTOMER',
        firstName: 'Test',
        lastName: 'Customer',
      },
    });

    // Note: Orders require products to be published first
    // This is a placeholder for when products are published

    console.log('✅ Sample data seeding completed!');

    // Summary
    console.log('\n📊 Seeding Summary:');
    console.log(`- Sellers created: 2`);
    console.log(`- Product submissions: 4 (SUBMITTED: 1, UNDER_REVIEW: 1, APPROVED: 1, REJECTED: 1)`);
    console.log(`- Fulfillment center: 1`);
    console.log(`- Shipment: 1`);
    console.log(`- Catalog entry: 1`);
    console.log(`- Marketing material: 1`);
    console.log(`- Product pricing: 1`);
    console.log(`- Customer: 1`);

    console.log('\n🔑 Test Credentials:');
    console.log(`Seller: seller-test@hos.test / ${SAMPLE_PASSWORDS.seller}`);
    console.log(`Wholesaler: wholesaler-test@hos.test / ${SAMPLE_PASSWORDS.wholesaler}`);
    console.log(`Customer: customer-test@hos.test / ${SAMPLE_PASSWORDS.customer}`);

  } catch (error) {
    console.error('❌ Error seeding data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
seedSampleData()
  .then(() => {
    console.log('✅ Seeding completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  });

