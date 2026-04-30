import { BOT_DETECTION } from '@/config/limits';
import { logger, safeErrorMeta } from '@/lib/logging/logger';
import { usageRepository } from '@/lib/db/usage-repository';

export interface BotDetectionResult {
  isBot: boolean;
  reason?: string;
}

export async function detectBot(
  userAgent: string | null,
  fingerprint: string
): Promise<BotDetectionResult> {
  // User-Agent検査
  if (!userAgent) {
    logger.warn('Missing User-Agent', { fingerprint });
    return { isBot: true, reason: 'missing_user_agent' };
  }

  const lowerUA = userAgent.toLowerCase();
  const isSuspiciousUA = BOT_DETECTION.SUSPICIOUS_USER_AGENTS.some((pattern) =>
    lowerUA.includes(pattern)
  );

  if (isSuspiciousUA) {
    logger.warn('Suspicious User-Agent detected', { fingerprint, userAgent });
    return { isBot: true, reason: 'suspicious_user_agent' };
  }

  // 連続リクエスト間隔チェック
  try {
    const usage = await usageRepository.getOrCreate(fingerprint);
    const timeSinceLastRequest = Date.now() - usage.lastRequestAt.getTime();

    if (
      usage.requestCount > 0 &&
      timeSinceLastRequest < BOT_DETECTION.MIN_REQUEST_INTERVAL_MS
    ) {
      logger.warn('Request interval too short', {
        fingerprint,
        interval: timeSinceLastRequest,
        threshold: BOT_DETECTION.MIN_REQUEST_INTERVAL_MS,
      });
      return { isBot: true, reason: 'request_too_fast' };
    }
  } catch (error) {
    logger.error('Bot detection failed during interval check', { fingerprint, ...safeErrorMeta(error) });
    // エラー時は通過させる（false positive回避）
  }

  return { isBot: false };
}
