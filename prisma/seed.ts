/**
 * Database Seed Script
 *
 * Seeds default data:
 * - Subscription plans (Free, Pro, Enterprise)
 * - Default admin user (optional)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Seed subscription plans
  const plans = [
    {
      name: 'free',
      displayName: 'Free',
      description: 'Perfect for personal projects and experimentation',
      priceMonth: 0,
      priceYear: 0,
      maxWorkspaces: 1,
      maxDocuments: 10,
      maxStorageBytes: BigInt(1024 * 1024 * 1024), // 1GB
      maxMessages: 100,
      maxApiCalls: 1000,
      features: {
        basicRag: true,
        semanticChunking: false,
        apiAccess: false,
        prioritySupport: false,
        customEmbeddings: false,
      },
      sortOrder: 1,
    },
    {
      name: 'pro',
      displayName: 'Pro',
      description: 'For professionals and small teams',
      priceMonth: 2900, // $29
      priceYear: 27840, // $23.20/month billed annually (20% off)
      maxWorkspaces: 5,
      maxDocuments: 100,
      maxStorageBytes: BigInt(10 * 1024 * 1024 * 1024), // 10GB
      maxMessages: 10000,
      maxApiCalls: 50000,
      features: {
        basicRag: true,
        semanticChunking: true,
        apiAccess: true,
        prioritySupport: true,
        customEmbeddings: true,
        advancedAnalytics: true,
      },
      sortOrder: 2,
    },
    {
      name: 'enterprise',
      displayName: 'Enterprise',
      description: 'For organizations with advanced needs',
      priceMonth: 0, // Custom pricing
      priceYear: 0,
      maxWorkspaces: 999,
      maxDocuments: 999999,
      maxStorageBytes: BigInt(100 * 1024 * 1024 * 1024), // 100GB+
      maxMessages: 999999,
      maxApiCalls: 999999,
      features: {
        basicRag: true,
        semanticChunking: true,
        apiAccess: true,
        prioritySupport: true,
        customEmbeddings: true,
        advancedAnalytics: true,
        sso: true,
        sla: true,
        dedicatedSupport: true,
      },
      sortOrder: 3,
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { name: plan.name },
      update: plan,
      create: plan,
    });
    console.log(`✅ Plan: ${plan.displayName}`);
  }

  console.log('✅ Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
