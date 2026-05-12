import type { Layer3Output, ExtractedConditions, AdditionalQuestionsNeeded, AdditionalAnswers } from '@/schemas/output.schema';
import type { ReclassificationResult } from '@/lib/q2d/reclassification';
import type { InvestmentTypeId } from '@/lib/q2d/effectiveType';
import { generateDCPrompt } from '@/lib/q2d/dc-prompt';
import { buildDCPromptParams } from '@/lib/q2d/dcPromptParams';

type MandatoryConditionsInput = {
  owner?: string;
  timeHorizon?: string;
  budgetSource?: string;
};

/**
 * prompt 文字列を生成する（buildDCPromptParams → generateDCPrompt の合成）
 *
 * CompleteScreen など UI コンポーネントがこの関数だけ呼べばよい
 */
export function createDCPrompt(params: {
  selectedType: InvestmentTypeId | null;
  reclassificationResult: ReclassificationResult | null | undefined;
  mandatoryConditions?: MandatoryConditionsInput;
  q1: string;
  q2: string;
  layer3: Layer3Output;
  extractedConditions: ExtractedConditions;
  additionalQuestionsNeeded: AdditionalQuestionsNeeded;
  additionalAnswers: AdditionalAnswers;
  hasDependencies: boolean;
  promptMode?: 'intermediate' | 'final';
  locale?: string;
  selectedQ2Id?: string;
}): string {
  return generateDCPrompt(buildDCPromptParams(params));
}
