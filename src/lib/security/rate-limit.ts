import { usageRepository } from '@/lib/db/usage-repository';
import { RATE_LIMIT } from '@/config/limits';
import { logger, safeErrorMeta } from '@/lib/logging/logger';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export async function checkRateLimit(fingerprint: string): Promise<RateLimitResult> {
  try {
    // 期限切れならリセット
    await usageRepository.resetIfExpired(fingerprint);

    // 現在のリクエスト数取得
    const currentCount = await usageRepository.getRecentRequestCount(fingerprint);

    const allowed = currentCount < RATE_LIMIT.MAX_REQUESTS;
    const remaining = Math.max(0, RATE_LIMIT.MAX_REQUESTS - currentCount);

    // resetAt: 最後のリクエストから24時間後
    const usage = await usageRepository.getOrCreate(fingerprint);
    const resetAt = new Date(usage.lastRequestAt.getTime() + RATE_LIMIT.WINDOW_MS);

    if (!allowed) {
      logger.warn('Rate limit exceeded', {
        fingerprint,
        currentCount,
        limit: RATE_LIMIT.MAX_REQUESTS,
      });
    }

    return {
      allowed,
      remaining,
      resetAt,
    };
  } catch (error) {
    logger.error('Rate limit check failed', { fingerprint, ...safeErrorMeta(error) });
    // エラー時は安全側に倒す（許可しない）
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + RATE_LIMIT.WINDOW_MS),
    };
  }
}
