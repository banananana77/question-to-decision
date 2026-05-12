import type { Layer3Output, ExtractedConditions, AdditionalQuestionsNeeded, AdditionalAnswers } from '@/schemas/output.schema';
import type { ReclassificationResult } from '@/lib/q2d/reclassification';
import type { InvestmentTypeId } from '@/lib/q2d/effectiveType';
import type { DCPromptParams } from '@/lib/q2d/dc-prompt';
import type { SupportedLocale } from '@/types/q2d';
import { buildFrontContext } from '@/lib/q2d/frontContext';

type MandatoryConditionsInput = {
  owner?: string;
  timeHorizon?: string;
  budgetSource?: string;
};

/**
 * generateDCPrompt() に渡す params を組み立てる（single source of truth）
 *
 * frontContext は buildFrontContext() 経由で生成する
 */
export function buildDCPromptParams(params: {
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
  locale?: SupportedLocale;
  selectedQ2Id?: string;
}): DCPromptParams {
  const {
    selectedType,
    reclassificationResult,
    mandatoryConditions,
    q1,
    q2,
    layer3,
    extractedConditions,
    additionalQuestionsNeeded,
    additionalAnswers,
    hasDependencies,
    promptMode,
    locale,
    selectedQ2Id,
  } = params;

  return {
    q1,
    q2,
    layer3,
    extractedConditions,
    additionalQuestionsNeeded,
    additionalAnswers,
    hasDependencies,
    frontContext: buildFrontContext({
      selectedType,
      reclassificationResult: reclassificationResult ?? null,
      mandatoryConditions,
    }),
    promptMode,
    locale,
    selectedQ2Id,
  };
}
