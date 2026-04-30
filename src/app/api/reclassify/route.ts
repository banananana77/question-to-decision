import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { reclassifyOtherType } from '@/lib/q2d/reclassification';
import { logger } from '@/lib/logging/logger';
import { checkAbuse } from '@/lib/security/abuse-check';
import { isDev } from '@/lib/utils/env.server';
import { safeErrorMeta } from '@/lib/logging/logger';

const MAX_BODY_BYTES = 64 * 1024; // 64KB

const bodySchema = z.object({
  q1: z.string().min(1).max(2000),
  q2: z.string().max(500).default(''),
  additional: z.string().max(1000).default(''),
});

export async function POST(request: NextRequest) {
  // 1. Content-Length check（LLM呼び出し前の最初の防壁）
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  // 2. fingerprint（headers / cookie から取得。body不要）
  const fingerprint =
    request.headers.get('x-fingerprint') ||
    request.cookies.get('fingerprint')?.value ||
    'unknown';

  try {
    // 3. Abuse Check（rate-limit + bot detection）
    const abuseCheck = await checkAbuse(fingerprint, request.headers.get('user-agent'), '/api/reclassify');

    if (!abuseCheck.allowed) {
      logger.warn('Abuse detected in reclassify API', {
        fingerprint,
        reason: abuseCheck.reason,
      });

      if (abuseCheck.reason === 'service_unavailable') {
        return NextResponse.json(
          { error: 'Service temporarily unavailable. Please try again later.' },
          { status: 503 }
        );
      }

      return NextResponse.json(
        { error: 'Too many requests or suspicious activity detected', reason: abuseCheck.reason },
        { status: 429 }
      );
    }

    // 4. JSON parse（不正JSON は本文をログに出さず 400 を返す）
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      logger.warn('Invalid JSON payload', { route: '/api/reclassify', status: 400 });
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // 5. Zod validation（fieldErrors は field名+エラー種別のみ。入力値は含まない）
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', ...(isDev() && { details: parsed.error.flatten().fieldErrors }) },
        { status: 400 }
      );
    }

    // 6. Reclassification実行
    const result = await reclassifyOtherType(parsed.data);

    logger.info('Reclassify API: Completed', {
      fingerprint,
      suggestedType: result.suggestedType,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    logger.error('Reclassify API failed', { route: '/api/reclassify', status: 500, fingerprint, ...safeErrorMeta(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
