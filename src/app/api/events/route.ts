import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { logger, safeErrorMeta } from '@/lib/logging/logger';
import { isDev } from '@/lib/utils/env.server';

const MAX_BODY_BYTES = 2 * 1024;
// LLMリクエスト制限（DEMO_MAX_REQUESTS_PER_DAY）とは独立した、イベント計測API専用の制限
const EVENT_RATE_LIMIT_PER_MINUTE = 30;  // 1分あたりの最大イベント記録数（per fingerprint）
const EVENT_RATE_WINDOW_MS = 60_000;

const bodySchema = z.object({
  eventType: z.enum(['complete_shown', 'copy_clicked']),
  locale: z.string().max(10).optional(),
  selectedType: z.string().max(100).optional(),
  effectiveType: z.string().max(100).optional(),
  promptMode: z.enum(['intermediate', 'final']).optional(),
  // Lengths only — never the actual content
  q1Length: z.number().int().min(0).max(10000).optional(),
  q2Length: z.number().int().min(0).max(10000).optional(),
  promptLength: z.number().int().min(0).max(100000).optional(),
  issueCount: z.number().int().min(0).max(100).optional(),
  reasonCount: z.number().int().min(0).max(100).optional(),
});

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  const fingerprint =
    request.headers.get('x-fingerprint') ||
    request.cookies.get('fingerprint')?.value ||
    'unknown';

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', ...(isDev() && { details: parsed.error.flatten().fieldErrors }) },
      { status: 400 }
    );
  }

  const { eventType, ...meta } = parsed.data;

  try {
    // 1分あたり30件を超えるイベントは記録しない（DEMO rate-limit とは独立）
    const windowStart = new Date(Date.now() - EVENT_RATE_WINDOW_MS);
    const recentCount = await prisma.auditLog.count({
      where: {
        fingerprint,
        action: { in: ['complete_shown', 'copy_clicked'] },
        createdAt: { gte: windowStart },
      },
    });
    if (recentCount >= EVENT_RATE_LIMIT_PER_MINUTE) {
      return NextResponse.json({ ok: false }, { status: 429 });
    }

    await prisma.auditLog.create({
      data: {
        fingerprint,
        action: eventType,
        resultType: 'event',
        metadata: meta,
      },
    });

    logger.info('Event recorded', { eventType, stage: 'events' });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    logger.error('Event recording failed', {
      route: '/api/events',
      stage: 'events',
      ...safeErrorMeta(error),
    });
    // イベント記録失敗は UX に影響しないためサイレントに 200 を返す
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
