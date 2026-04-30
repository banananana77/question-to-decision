import type { InvestmentTypeId } from '@/components/q2d/TypeSelection';

export interface TypeQuestionKeys {
  q1: string;
  q2: string;
  additional: string;
}

const TYPE_QUESTION_KEYS: Record<Exclude<InvestmentTypeId, 'other'> | 'generic', TypeQuestionKeys> = {
  continuation: {
    q1: 'typeQ_continuation_q1',
    q2: 'typeQ_continuation_q2',
    additional: 'typeQ_continuation_additional',
  },
  roi_interpretation: {
    q1: 'typeQ_roi_q1',
    q2: 'typeQ_roi_q2',
    additional: 'typeQ_roi_additional',
  },
  expansion: {
    q1: 'typeQ_generic_q1',
    q2: 'typeQ_generic_q2',
    additional: 'typeQ_generic_additional',
  },
  responsibility_structure: {
    q1: 'typeQ_responsibility_q1',
    q2: 'typeQ_responsibility_q2',
    additional: 'typeQ_responsibility_additional',
  },
  pre_adoption: {
    q1: 'typeQ_generic_q1',
    q2: 'typeQ_pre_adoption_q2',
    additional: 'typeQ_generic_additional',
  },
  generic: {
    q1: 'typeQ_generic_q1',
    q2: 'typeQ_generic_q2',
    additional: 'typeQ_generic_additional',
  },
} as const;

/** selectedType から翻訳キーセットを解決する。other → generic */
export function resolveTypeQuestions(selectedType: InvestmentTypeId | null): TypeQuestionKeys {
  if (!selectedType || selectedType === 'other') {
    return TYPE_QUESTION_KEYS.generic;
  }
  return TYPE_QUESTION_KEYS[selectedType];
}
