import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { runQ2DPipeline } from '@/lib/q2d';
import { logger } from '@/lib/logging/logger';
import { checkAbuse } from '@/lib/security/abuse-check';
import { usageRepository } from '@/lib/db/usage-repository';
import { isDev } from '@/lib/utils/env.server';
import { safeErrorMeta } from '@/lib/logging/logger';
import type { AdditionalQuestionsNeeded, ExtractedConditions, Q2DPipelineResult } from '@/schemas/output.schema';

const MAX_BODY_BYTES = 64 * 1024; // 64KB

const bodySchema = z.object({
  q1: z.string().min(1).max(2000),
  q2: z.string().min(1).max(500),
  locale: z.string().optional(),
});

function deriveAdditionalQuestions(
  extractedConditions: ExtractedConditions
): AdditionalQuestionsNeeded {
  return {
    owner: extractedConditions.owner === null,
    timeHorizon: extractedConditions.timeHorizon === null,
    decisionRule: extractedConditions.decisionRule === null,
  };
}

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
    const abuseCheck = await checkAbuse(fingerprint, request.headers.get('user-agent'), '/api/q2d-pipeline');

    if (!abuseCheck.allowed) {
      logger.warn('Abuse detected in q2d-pipeline API', {
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
      logger.warn('Invalid JSON payload', { route: '/api/q2d-pipeline', status: 400 });
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

    const { q1, q2, locale } = parsed.data;

    // 6. Usage Increment（validation 通過後のみカウント）
    await usageRepository.incrementRequest(fingerprint);

    logger.info('q2d-pipeline API: Starting', { q1Length: q1.length });

    // 7. Pipeline実行
    const pipelineResult = await runQ2DPipeline(q1, locale);

    const additionalQuestionsNeeded = deriveAdditionalQuestions(
      pipelineResult.extractedConditions
    );

    const hasDependencies = pipelineResult.layer2.dependencies.length > 0;

    const result: Q2DPipelineResult = {
      q1,
      q2,
      layer1: pipelineResult.layer1,
      layer2: pipelineResult.layer2,
      layer3: pipelineResult.layer3,
      notAskableReasons: pipelineResult.notAskableReasons,
      extractedConditions: pipelineResult.extractedConditions,
      additionalQuestionsNeeded,
      hasDependencies,
    };

    logger.info('q2d-pipeline API: Completed', {
      fingerprint,
      isMixed: result.layer1.isMixed,
      issueCount: result.layer2.issues.length,
      additionalQuestionsNeeded,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    logger.error('q2d-pipeline API failed', { route: '/api/q2d-pipeline', status: 500, fingerprint, ...safeErrorMeta(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
