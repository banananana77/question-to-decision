import { prisma } from '@/lib/db/client';
import { logger, safeErrorMeta } from '@/lib/logging/logger';
import type { UsageRecord } from '@/types/q2d';

export class UsageRepository {
  /**
   * 使用状況を取得（存在しなければ新規作成）
   */
  async getOrCreate(fingerprint: string): Promise<UsageRecord> {
    try {
      const usage = await prisma.usage.upsert({
        where: { fingerprint },
        update: {},
        create: {
          fingerprint,
          requestCount: 0,
          lastRequestAt: new Date(),
        },
      });

      return {
        fingerprint: usage.fingerprint,
        requestCount: usage.requestCount,
        lastRequestAt: usage.lastRequestAt,
      };
    } catch (error) {
      logger.error('Failed to get or create usage record', { fingerprint, ...safeErrorMeta(error) });
      throw error;
    }
  }

  /**
   * リクエストカウントをインクリメント
   */
  async incrementRequest(fingerprint: string): Promise<UsageRecord> {
    try {
      const usage = await prisma.usage.update({
        where: { fingerprint },
        data: {
          requestCount: { increment: 1 },
          lastRequestAt: new Date(),
        },
      });

      return {
        fingerprint: usage.fingerprint,
        requestCount: usage.requestCount,
        lastRequestAt: usage.lastRequestAt,
      };
    } catch (error) {
      logger.error('Failed to increment request count', { fingerprint, ...safeErrorMeta(error) });
      throw error;
    }
  }

  /**
   * 24時間以内のリクエスト数を取得
   */
  async getRecentRequestCount(fingerprint: string): Promise<number> {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const usage = await prisma.usage.findUnique({
        where: { fingerprint },
      });

      if (!usage) {
        return 0;
      }

      // lastRequestAt が24時間以内ならカウント維持、古ければリセット扱い
      if (usage.lastRequestAt < oneDayAgo) {
        return 0;
      }

      return usage.requestCount;
    } catch (error) {
      logger.error('Failed to get recent request count', { fingerprint, ...safeErrorMeta(error) });
      throw error;
    }
  }

  /**
   * 24時間経過したらカウントリセット
   */
  async resetIfExpired(fingerprint: string): Promise<void> {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      await prisma.usage.updateMany({
        where: {
          fingerprint,
          lastRequestAt: { lt: oneDayAgo },
        },
        data: {
          requestCount: 0,
          lastRequestAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to reset expired usage', { fingerprint, ...safeErrorMeta(error) });
      throw error;
    }
  }
}

export const usageRepository = new UsageRepository();
