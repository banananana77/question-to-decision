import { callClaude } from '@/lib/llm/client';
import { createQ1AnalysisPrompt } from '@/lib/llm/prompts';
import { q1AnalysisOutputSchema, type Q1AnalysisOutput } from '@/schemas/output.schema';
import { logger, safeErrorMeta } from '@/lib/logging/logger';

function extractJSON(text: string): string {
  const jsonMatch =
    text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
  return jsonMatch ? jsonMatch[1].trim() : text.trim();
}

/**
 * Q1回答から2問目の選択肢を生成する（軽量解析）
 * Layer 1 とは独立した処理
 */
export async function analyzeQ1(q1: string): Promise<Q1AnalysisOutput> {
  try {
    logger.info('Q1 Analysis: Starting option generation');

    const prompt = createQ1AnalysisPrompt(q1);
    const response = await callClaude({
      prompt,
      maxTokens: 400,
      temperature: 0.4,
    });

    const parsed = JSON.parse(extractJSON(response));
    const result = q1AnalysisOutputSchema.parse(parsed);

    logger.info('Q1 Analysis: Options generated', { count: result.options.length });
    return result;
  } catch (error) {
    logger.error('Q1 Analysis failed, returning fallback options', { stage: 'q1_analyze', ...safeErrorMeta(error) });

    // フォールバック：汎用選択肢
    return {
      options: [
        { id: 'opt_1', text: '継続・停止の判断基準を明確にしたい' },
        { id: 'opt_2', text: '最終判断者と責任範囲を明確にしたい' },
      ],
    };
  }
}
