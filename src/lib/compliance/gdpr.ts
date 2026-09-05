/**
 * GDPR Compliance Module
 *
 * Implements data erasure (right to be forgotten), data export,
 * and consent management for GDPR compliance.
 */

import { randomBytes, timingSafeEqual } from 'node:crypto';

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getRedis } from '@/lib/redis';

// =============================================================================
// Types
// =============================================================================

export interface DataErasureRequest {
  userId: string;
  requestType: 'full' | 'documents' | 'chats' | 'account';
  reason?: string;
  verificationToken: string;
}

export interface DataExportRequest {
  userId: string;
  format: 'json' | 'csv' | 'pdf';
  includeDocuments: boolean;
  includeChats: boolean;
  includeUsageData: boolean;
}

export interface ErasureReport {
  userId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  itemsProcessed: {
    documents: number;
    chats: number;
    messages: number;
    apiKeys: number;
    auditLogs: number;
  };
  errors: string[];
}

// =============================================================================
// Data Erasure (Right to be Forgotten)
// =============================================================================

/**
 * Process a data erasure request (GDPR Article 17)
 */
export async function processDataErasure(request: DataErasureRequest): Promise<ErasureReport> {
  const report: ErasureReport = {
    userId: request.userId,
    status: 'processing',
    startedAt: new Date(),
    itemsProcessed: {
      documents: 0,
      chats: 0,
      messages: 0,
      apiKeys: 0,
      auditLogs: 0,
    },
    errors: [],
  };

  logger.info('Starting GDPR data erasure', {
    userId: request.userId,
    type: request.requestType,
  });

  try {
    // Verify token
    const isValid = await verifyErasureToken(request.userId, request.verificationToken);
    if (!isValid) {
      throw new Error('Invalid verification token');
    }

    switch (request.requestType) {
      case 'full':
        await eraseAllUserData(request.userId, report);
        break;
      case 'documents':
        await eraseUserDocuments(request.userId, report);
        break;
      case 'chats':
        await eraseUserChats(request.userId, report);
        break;
      case 'account':
        await eraseUserAccount(request.userId, report);
        break;
    }

    report.status = 'completed';
    report.completedAt = new Date();

    // Log the erasure for compliance
    await logErasureEvent(request, report);
  } catch (error) {
    report.status = 'failed';
    report.errors.push(error instanceof Error ? error.message : 'Unknown error');

    logger.error('Data erasure failed', {
      userId: request.userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  return report;
}

/**
 * Erase all user data
 */
async function eraseAllUserData(userId: string, report: ErasureReport): Promise<void> {
  // Delete in order to respect foreign key constraints

  // 1. API Usage
  await prisma.apiUsage.deleteMany({ where: { userId } });

  // 2. Rate limits
  await prisma.rateLimit.deleteMany({ where: { userId } });

  // 3. API Keys
  const apiKeysDeleted = await prisma.apiKey.deleteMany({ where: { userId } });
  report.itemsProcessed.apiKeys = apiKeysDeleted.count;

  // 4. Document chunks (pgvector rows)
  const documents = await prisma.document.findMany({
    where: { userId },
    select: { id: true },
  });

  const { deleteByDocumentId } = await import('@/lib/vector');
  for (const doc of documents) {
    await deleteByDocumentId(doc.id);
  }

  // 5. Documents
  const docsDeleted = await prisma.document.deleteMany({ where: { userId } });
  report.itemsProcessed.documents = docsDeleted.count;

  // 6. Messages and chats
  const chats = await prisma.chat.findMany({
    where: { userId },
    select: { id: true },
  });

  for (const chat of chats) {
    const messagesDeleted = await prisma.message.deleteMany({
      where: { chatId: chat.id },
    });
    report.itemsProcessed.messages += messagesDeleted.count;
  }

  const chatsDeleted = await prisma.chat.deleteMany({ where: { userId } });
  report.itemsProcessed.chats = chatsDeleted.count;

  // 7. Workspace memberships (but not workspaces if they have other members)
  await prisma.workspaceMember.deleteMany({ where: { userId } });

  // 8. Audit logs - anonymize instead of delete for compliance
  await anonymizeAuditLogs(userId);
  report.itemsProcessed.auditLogs = await prisma.auditLog.count({ where: { userId } });

  // 9. Finally, delete user
  await prisma.user.delete({ where: { id: userId } });
}

/**
 * Erase only user documents
 */
async function eraseUserDocuments(userId: string, report: ErasureReport): Promise<void> {
  const documents = await prisma.document.findMany({
    where: { userId },
    select: { id: true },
  });

  const { deleteByDocumentId } = await import('@/lib/vector');
  for (const doc of documents) {
    await deleteByDocumentId(doc.id);
  }

  const result = await prisma.document.deleteMany({ where: { userId } });
  report.itemsProcessed.documents = result.count;
}

/**
 * Erase user chats
 */
async function eraseUserChats(userId: string, report: ErasureReport): Promise<void> {
  const chats = await prisma.chat.findMany({
    where: { userId },
    select: { id: true },
  });

  for (const chat of chats) {
    const messagesDeleted = await prisma.message.deleteMany({
      where: { chatId: chat.id },
    });
    report.itemsProcessed.messages += messagesDeleted.count;
  }

  const result = await prisma.chat.deleteMany({ where: { userId } });
  report.itemsProcessed.chats = result.count;
}

/**
 * Erase user account but keep documents/chats
 */
async function eraseUserAccount(userId: string, _report: ErasureReport): Promise<void> {
  // Anonymize personal data
  const hashedId = Buffer.from(userId).toString('base64').slice(0, 12);

  await prisma.user.update({
    where: { id: userId },
    data: {
      name: 'Deleted User',
      email: `deleted-${hashedId}@anonymized.local`,
      password: null,
      image: null,
    },
  });

  // Delete auth-related data
  await prisma.account.deleteMany({ where: { userId } });
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.apiKey.deleteMany({ where: { userId } });
}

/**
 * Anonymize audit logs (keep for compliance, remove PII)
 */
async function anonymizeAuditLogs(userId: string): Promise<void> {
  const hashedId = Buffer.from(userId).toString('base64').slice(0, 12);

  await prisma.auditLog.updateMany({
    where: { userId },
    data: {
      userId: `anonymized-${hashedId}`,
      metadata: {},
      ipAddress: null,
      userAgent: null,
    },
  });
}

// =============================================================================
// Data Export (GDPR Article 20)
// =============================================================================

/**
 * Export user data in requested format
 */
export async function exportUserData(request: DataExportRequest): Promise<{
  data: Record<string, unknown>;
  format: string;
  generatedAt: Date;
}> {
  const exportData: Record<string, unknown> = {
    userId: request.userId,
    exportedAt: new Date().toISOString(),
    version: '1.0',
  };

  // Get user profile
  const user = await prisma.user.findUnique({
    where: { id: request.userId },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  exportData.profile = user;

  // Export documents
  if (request.includeDocuments) {
    const documents = await prisma.document.findMany({
      where: { userId: request.userId },
      select: {
        id: true,
        name: true,
        contentType: true,
        size: true,
        metadata: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    exportData.documents = documents;
  }

  // Export chats and messages
  if (request.includeChats) {
    const chats = await prisma.chat.findMany({
      where: { userId: request.userId },
      include: {
        messages: {
          select: {
            id: true,
            content: true,
            role: true,
            createdAt: true,
          },
        },
      },
    });
    exportData.chats = chats;
  }

  // Export usage data
  if (request.includeUsageData) {
    const usage = await prisma.apiUsage.findMany({
      where: { userId: request.userId },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
    exportData.usage = usage;
  }

  return {
    data: exportData,
    format: request.format,
    generatedAt: new Date(),
  };
}

// =============================================================================
// Consent Management
// =============================================================================

export interface ConsentRecord {
  userId: string;
  consentType: 'analytics' | 'marketing' | 'data_processing';
  granted: boolean;
  grantedAt: Date;
  ipAddress?: string;
  userAgent?: string;
  version: string;
}

/**
 * Record user consent
 */
export async function recordConsent(consent: ConsentRecord): Promise<void> {
  await prisma.consent.create({
    data: {
      userId: consent.userId,
      consentType: consent.consentType,
      granted: consent.granted,
      grantedAt: consent.grantedAt,
      version: consent.version,
      ipAddress: consent.ipAddress,
      userAgent: consent.userAgent,
    },
  });

  logger.info('Consent recorded', {
    userId: consent.userId,
    type: consent.consentType,
    granted: consent.granted,
  });
}

/**
 * Check if user has given consent
 */
export async function hasConsent(userId: string, consentType: string): Promise<boolean> {
  const latest = await prisma.consent.findFirst({
    where: { userId, consentType, revokedAt: null },
    orderBy: { grantedAt: 'desc' },
  });
  return latest?.granted ?? false;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generate erasure verification token
 * Stores a cryptographic token in Redis with a 24-hour TTL.
 */
export async function generateErasureToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const redis = getRedis();
  const key = `gdpr:erasure:${userId}`;
  await redis.set(key, token, { ex: 86400 }); // 24-hour TTL
  return token;
}

/**
 * Verify erasure token
 * Compares against the stored token using timing-safe comparison.
 */
async function verifyErasureToken(userId: string, token: string): Promise<boolean> {
  const redis = getRedis();
  const key = `gdpr:erasure:${userId}`;
  const stored = await redis.get<string>(key);

  if (!stored || typeof stored !== 'string') {
    return false;
  }

  try {
    return timingSafeEqual(Buffer.from(stored), Buffer.from(token));
  } catch {
    return false;
  }
}

/**
 * Log erasure event for compliance
 */
async function logErasureEvent(request: DataErasureRequest, report: ErasureReport): Promise<void> {
  logger.info('GDPR erasure completed', {
    userId: request.userId,
    type: request.requestType,
    itemsProcessed: report.itemsProcessed,
    duration: report.completedAt ? report.completedAt.getTime() - report.startedAt.getTime() : 0,
  });
}

/**
 * Get data retention statistics
 */
export async function getDataRetentionStats(): Promise<{
  totalUsers: number;
  totalDocuments: number;
  totalChats: number;
  staleDataCount: number;
}> {
  const [totalUsers, totalDocuments, totalChats] = await Promise.all([
    prisma.user.count(),
    prisma.document.count(),
    prisma.chat.count(),
  ]);

  // Find data older than retention period (e.g., 2 years)
  const twoYearsAgo = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000);

  const staleDataCount = await prisma.document.count({
    where: {
      createdAt: { lt: twoYearsAgo },
      status: 'COMPLETED',
    },
  });

  return {
    totalUsers,
    totalDocuments,
    totalChats,
    staleDataCount,
  };
}
