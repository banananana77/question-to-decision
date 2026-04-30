import type { ReclassificationResult } from '@/lib/q2d/reclassification';

export type InvestmentTypeId =
  | 'continuation'
  | 'roi_interpretation'
  | 'expansion'
  | 'responsibility_structure'
  | 'pre_adoption'
  | 'other';

/**
 * 表示・prompt 両方で使う実効型判定（single source of truth）
 *
 * selectedType === 'other' かつ以下をすべて満たす場合のみ suggestedType を採用する:
 *   - reclassificationResult が存在する
 *   - confidence >= 0.7
 *   - suggestedType !== 'truly_other'
 *
 * それ以外はすべて selectedType をそのまま使う（null の場合は 'other' にフォールバック）
 */
export function resolveEffectiveType(params: {
  selectedType: InvestmentTypeId | null;
  reclassificationResult: ReclassificationResult | null | undefined;
}): InvestmentTypeId {
  const { selectedType, reclassificationResult } = params;

  return selectedType === 'other' &&
    reclassificationResult != null &&
    reclassificationResult.confidence >= 0.7 &&
    reclassificationResult.suggestedType !== 'truly_other'
    ? (reclassificationResult.suggestedType as InvestmentTypeId)
    : (selectedType ?? 'other');
}
