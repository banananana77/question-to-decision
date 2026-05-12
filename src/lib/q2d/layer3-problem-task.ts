import { callClaude } from '@/lib/llm/client';
import { createLayer3Prompt, createLayer3PromptEn, createNotAskablePrompt } from '@/lib/llm/prompts';
import { parseLayer3Output, parseNotAskableOutput } from '@/lib/llm/parser';
import { logger, safeErrorMeta } from '@/lib/logging/logger';
import type { Layer2Output, Layer3Output, ExtractedConditions } from '@/schemas/output.schema';
import type { NotAskableReason, SupportedLocale } from '@/types/q2d';

export interface NotAskableResult {
  reasons: NotAskableReason[];
  extractedConditions: ExtractedConditions;
}

/**
 * Layer 3: 問題/課題切り分け
 */
export async function convertProblemTask(layer2Result: Layer2Output, locale?: SupportedLocale): Promise<Layer3Output> {
  try {
    logger.info('Layer3: Starting problem-task conversion');

    const prompt = (locale ?? 'ja') === 'en'
      ? createLayer3PromptEn(layer2Result.issues)
      : createLayer3Prompt(layer2Result.issues);
    const response = await callClaude({
      prompt,
      maxTokens: 2000,
      temperature: 0.3,
    });

    const result = parseLayer3Output(response);

    logger.info('Layer3: Problem-task conversion completed', {
      problemCount: result.problems.length,
      taskCount: result.tasks.length,
    });

    return result;
  } catch (error) {
    logger.error('Layer3: Problem-task conversion failed', { stage: 'layer3', ...safeErrorMeta(error) });
    throw new Error('Layer3 processing failed');
  }
}

/**
 * 「問えない理由」の抽出 + 判断条件の検出値抽出
 */
export async function extractNotAskableReasons(
  inputText: string,
  layer3Result: Layer3Output
): Promise<NotAskableResult> {
  try {
    logger.info('Extracting not-askable reasons');

    const prompt = createNotAskablePrompt(inputText, layer3Result.tasks);
    const response = await callClaude({
      prompt,
      maxTokens: 1200,
      temperature: 0.3,
    });

    const { reasons, extractedConditions } = parseNotAskableOutput(response);

    // 同一カテゴリの重複を排除（より詳細な説明を優先）
    const uniqueReasons = reasons.reduce((acc, reason) => {
      const existing = acc.find((r) => r.category === reason.category);
      if (!existing) {
        acc.push(reason);
      } else if (reason.description.length > existing.description.length) {
        existing.description = reason.description;
        existing.evidence = reason.evidence ?? existing.evidence;
      }
      return acc;
    }, [] as NotAskableReason[]);

    logger.info('Not-askable reasons extracted', {
      rawCount: reasons.length,
      uniqueCount: uniqueReasons.length,
      conditionsResolved: {
        owner: extractedConditions.owner !== null,
        timeHorizon: extractedConditions.timeHorizon !== null,
        decisionRule: extractedConditions.decisionRule !== null,
      },
    });

    return { reasons: uniqueReasons, extractedConditions };
  } catch (error) {
    logger.error('Failed to extract not-askable reasons', { stage: 'not_askable', ...safeErrorMeta(error) });
    return {
      reasons: [{ category: 'decision_rule_ambiguous', description: '詳細な分析が必要です' }],
      extractedConditions: { owner: null, timeHorizon: null, decisionRule: null },
    };
  }
}
