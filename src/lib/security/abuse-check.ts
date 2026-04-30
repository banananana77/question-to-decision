import { checkRateLimit } from '@/lib/security/rate-limit';
import { detectBot } from '@/lib/security/bot-detection';
import { logger, safeErrorMeta } from '@/lib/logging/logger';
import { prisma } from '@/lib/db/client';

export interface AbuseCheckResult {
  allowed: boolean;
  reason?: 'rate_limit' | 'bot_detected' | 'service_unavailable';
  details?: string;
}

export async function checkAbuse(
  fingerprint: string,
  userAgent: string | null,
  route?: string
): Promise<AbuseCheckResult> {
  try {
    // Bot検知
    const botCheck = await detectBot(userAgent, fingerprint);
    if (botCheck.isBot) {
      await prisma.auditLog.create({
        data: {
          fingerprint,
          action: 'blocked',
          resultType: 'bot_detected',
          metadata: { reason: botCheck.reason },
        },
      });

      return {
        allowed: false,
        reason: 'bot_detected',
        details: botCheck.reason,
      };
    }

    // Rate Limit検査
    const rateLimit = await checkRateLimit(fingerprint);
    if (!rateLimit.allowed) {
      await prisma.auditLog.create({
        data: {
          fingerprint,
          action: 'rate_limited',
          resultType: 'blocked',
          metadata: {
            resetAt: rateLimit.resetAt.toISOString(),
            ...(route && { route }),
          },
        },
      });

      return {
        allowed: false,
        reason: 'rate_limit',
      };
    }

    return { allowed: true };
  } catch (error) {
    logger.error('Abuse check failed', { fingerprint, ...safeErrorMeta(error) });
    return {
      allowed: false,
      reason: 'service_unavailable',
    };
  }
}
