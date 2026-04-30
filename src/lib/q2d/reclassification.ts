import { callClaude } from '@/lib/llm/client';
import { logger } from '@/lib/logging/logger';

export type ReclassifiedType =
  | 'continuation'
  | 'roi_interpretation'
  | 'responsibility_structure'
  | 'truly_other';

export interface ReclassificationResult {
  suggestedType: ReclassifiedType;
  confidence: number;
  reasoning: string;
}

const RECLASSIFICATION_PROMPT = (input: string) => `以下の入力を読み、最も近い判断パターンに分類してください。

# 入力
${input}

# 分類基準
- continuation: AI投資の継続・停止・縮小の判断ができない状況
- roi_interpretation: ROI未達の解釈や原因分析に困っている状況
- responsibility_structure: 誰が判断すべきか責任が曖昧な状況
- truly_other: 上記3つのいずれにも当てはまらない

# 出力形式
Markdown記法は使わず、JSONのみを出力してください。

{
  "suggestedType": "continuation" | "roi_interpretation" | "responsibility_structure" | "truly_other",
  "confidence": 0.0〜1.0の数値,
  "reasoning": "分類理由を1〜2文で"
}`;

function extractJSON(text: string): string {
  const match = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
  return match ? match[1].trim() : text.trim();
}

const VALID_TYPES: ReclassifiedType[] = [
  'continuation',
  'roi_interpretation',
  'responsibility_structure',
  'truly_other',
];

export async function reclassifyOtherType(input: {
  q1: string;
  q2: string;
  additional: string;
}): Promise<ReclassificationResult> {
  const combined = [input.q1, input.q2, input.additional].filter(Boolean).join('\n');

  const response = await callClaude({
    prompt: RECLASSIFICATION_PROMPT(combined),
    maxTokens: 300,
    temperature: 0.2,
  });

  const parsed = JSON.parse(extractJSON(response));

  if (!VALID_TYPES.includes(parsed.suggestedType)) {
    throw new Error(`Invalid suggestedType: ${parsed.suggestedType}`);
  }

  const result: ReclassificationResult = {
    suggestedType: parsed.suggestedType,
    confidence: Number(parsed.confidence),
    reasoning: String(parsed.reasoning),
  };

  logger.info('Reclassification completed', {
    suggestedType: result.suggestedType,
    confidence: result.confidence,
  });
  return result;
}
