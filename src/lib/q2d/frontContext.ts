import type { ReclassificationResult } from '@/lib/q2d/reclassification';
import type { InvestmentTypeId } from '@/lib/q2d/effectiveType';
import { resolveEffectiveType } from '@/lib/q2d/effectiveType';
import type { FrontContext } from '@/lib/q2d/dc-prompt';

export type { FrontContext };

type MandatoryConditionsInput = {
  owner?: string;
  timeHorizon?: string;
  budgetSource?: string;
};

/**
 * DC prompt に渡す frontContext を組み立てる（single source of truth）
 *
 * selectedType が null の場合は undefined を返す（prompt への挿入なし）
 */
export function buildFrontContext(params: {
  selectedType: InvestmentTypeId | null;
  reclassificationResult: ReclassificationResult | null | undefined;
  mandatoryConditions?: MandatoryConditionsInput;
}): FrontContext | undefined {
  const { selectedType, reclassificationResult, mandatoryConditions } = params;

  if (selectedType == null) return undefined;

  return {
    selectedType,
    effectiveType: resolveEffectiveType({
      selectedType,
      reclassificationResult: reclassificationResult ?? null,
    }),
    mandatoryConditions: {
      owner: mandatoryConditions?.owner ?? '',
      timeHorizon: mandatoryConditions?.timeHorizon ?? '',
      budgetSource: mandatoryConditions?.budgetSource ?? '',
    },
  };
}
