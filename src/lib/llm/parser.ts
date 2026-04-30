import { logger, safeErrorMeta } from '@/lib/logging/logger';
import {
  layer1OutputSchema,
  layer2OutputSchema,
  layer3OutputSchema,
  type Layer1Output,
  type Layer2Output,
  type Layer3Output,
  type ExtractedConditions,
} from '@/schemas/output.schema';
import type { NotAskableReason } from '@/types/q2d';

export interface NotAskableOutput {
  reasons: NotAskableReason[];
  extractedConditions: ExtractedConditions;
}

const DEFAULT_EXTRACTED_CONDITIONS: ExtractedConditions = {
  owner: null,
  timeHorizon: null,
  decisionRule: null,
};

/**
 * Claude APIレスポンスからJSONを抽出
 */
function extractJSON(text: string): string {
  // Markdown fence除去
  const jsonMatch =
    text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);

  if (jsonMatch) {
    return jsonMatch[1].trim();
  }

  // fenceなしの場合はそのまま
  return text.trim();
}

/**
 * Layer 1 出力のパース
 */
export function parseLayer1Output(responseText: string): Layer1Output {
  try {
    const jsonText = extractJSON(responseText);
    const parsed = JSON.parse(jsonText);
    return layer1OutputSchema.parse(parsed);
  } catch (error) {
    logger.error('Failed to parse Layer1 output', { stage: 'parse_layer1', responseLength: responseText.length, ...safeErrorMeta(error) });
    throw new Error('Layer1 output parsing failed');
  }
}

/**
 * Layer 2 出力のパース
 */
export function parseLayer2Output(responseText: string): Layer2Output {
  try {
    const jsonText = extractJSON(responseText);
    const parsed = JSON.parse(jsonText);
    return layer2OutputSchema.parse(parsed);
  } catch (error) {
    logger.error('Failed to parse Layer2 output', { stage: 'parse_layer2', responseLength: responseText.length, ...safeErrorMeta(error) });
    throw new Error('Layer2 output parsing failed');
  }
}

/**
 * Layer 3 出力のパース
 */
export function parseLayer3Output(responseText: string): Layer3Output {
  try {
    const jsonText = extractJSON(responseText);
    const parsed = JSON.parse(jsonText);
    return layer3OutputSchema.parse(parsed);
  } catch (error) {
    logger.error('Failed to parse Layer3 output', { stage: 'parse_layer3', responseLength: responseText.length, ...safeErrorMeta(error) });
    throw new Error('Layer3 output parsing failed');
  }
}

/**
 * 「問えない理由」と判断条件の抽出値をパース
 */
export function parseNotAskableOutput(responseText: string): NotAskableOutput {
  try {
    const jsonText = extractJSON(responseText);
    const parsed = JSON.parse(jsonText);

    if (!parsed.reasons || !Array.isArray(parsed.reasons)) {
      throw new Error('Invalid reasons format');
    }

    const reasons = parsed.reasons as NotAskableReason[];

    // extractedConditions が返ってこない旧フォーマットにも対応
    const raw = parsed.extractedConditions ?? {};
    const extractedConditions: ExtractedConditions = {
      owner: typeof raw.owner === 'string' ? raw.owner : null,
      timeHorizon: typeof raw.timeHorizon === 'string' ? raw.timeHorizon : null,
      decisionRule: typeof raw.decisionRule === 'string' ? raw.decisionRule : null,
    };

    return { reasons, extractedConditions };
  } catch (error) {
    logger.error('Failed to parse NotAskable output', { stage: 'parse_not_askable', responseLength: responseText.length, ...safeErrorMeta(error) });
    return {
      reasons: [{ category: 'decision_rule_ambiguous', description: '詳細な分析が必要です' }],
      extractedConditions: DEFAULT_EXTRACTED_CONDITIONS,
    };
  }
}
