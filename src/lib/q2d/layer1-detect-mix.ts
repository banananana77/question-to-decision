import { callClaude } from '@/lib/llm/client';
import { createLayer1Prompt } from '@/lib/llm/prompts';
import { parseLayer1Output } from '@/lib/llm/parser';
import { logger, safeErrorMeta } from '@/lib/logging/logger';
import type { Layer1Output } from '@/schemas/output.schema';

/**
 * Layer 1: 混線検知
 * 入力テキストに複数論点が混在しているか判定
 */
export async function detectMix(inputText: string): Promise<Layer1Output> {
  try {
    logger.info('Layer1: Starting mix detection');

    const prompt = createLayer1Prompt(inputText);
    const response = await callClaude({
      prompt,
      maxTokens: 500,
      temperature: 0.3,
    });

    const result = parseLayer1Output(response);

    logger.info('Layer1: Mix detection completed', {
      isMixed: result.isMixed,
    });

    return result;
  } catch (error) {
    logger.error('Layer1: Mix detection failed', { stage: 'layer1', ...safeErrorMeta(error) });
    throw new Error('Layer1 processing failed');
  }
}
