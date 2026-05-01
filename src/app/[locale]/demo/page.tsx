'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Step1 } from '@/components/q2d/Step1';
import { Step2 } from '@/components/q2d/Step2';
import { CompleteScreen } from '@/components/q2d/CompleteScreen';
import { TypeSelection, type InvestmentTypeId } from '@/components/q2d/TypeSelection';
import { MandatoryConditionsForm, type MandatoryConditions } from '@/components/q2d/MandatoryConditionsForm';
import { resolveTypeQuestions } from '@/lib/q2d/typeSpecificQuestions';
import type { ReclassificationResult } from '@/lib/q2d/reclassification';

import type {
  Q2Option,
  Q2DPipelineResult,
  AdditionalAnswers,
  AdditionalQuestionsNeeded,
} from '@/schemas/output.schema';

type Step =
  | 'type_select'
  | 'mandatory_conditions'
  | 'q1'
  | 'loading_q2'
  | 'q2'
  | 'processing'
  | 'complete'
  | 'dc_error';

interface DemoState {
  step: Step;
  selectedType: InvestmentTypeId | null;
  mandatoryConditions: MandatoryConditions;
  q1: string;
  q2Options: Q2Option[];
  q2: string;
  selectedQ2Id: string;
  pipelineResult: Q2DPipelineResult | null;
  additionalQuestionsNeeded: AdditionalQuestionsNeeded;
  additionalAnswers: AdditionalAnswers;
  reclassificationResult: ReclassificationResult | null;
  error: string;
}

const INITIAL_STATE: DemoState = {
  step: 'type_select',
  selectedType: null,
  mandatoryConditions: { owner: '', timeHorizon: '', budgetSource: '', decisionRule: '' },
  q1: '',
  q2Options: [],
  q2: '',
  selectedQ2Id: '',
  pipelineResult: null,
  additionalQuestionsNeeded: { owner: false, timeHorizon: false, decisionRule: false },
  additionalAnswers: {},
  reclassificationResult: null,
  error: '',
};

export default function DemoPage() {
  const t = useTranslations('q2d');

  const FIXED_Q2_OPTIONS: Q2Option[] = [
    { id: 'opt_1', text: t('q2Option_opt1') },
    { id: 'opt_2', text: t('q2Option_opt2') },
    { id: 'opt_3', text: t('q2Option_opt3') },
    { id: 'opt_4', text: t('q2Option_opt4') },
  ];

  // pre_adoption 専用選択肢 — ID は routing 判定に使う内部キー
  const PRE_ADOPTION_Q2_OPTIONS: Q2Option[] = [
    { id: 'pre_basis',      text: t('q2Option_preBasis') },
    { id: 'pre_scope',      text: t('q2Option_preScope') },
    { id: 'pre_pilot',      text: t('q2Option_prePilot') },
    { id: 'pre_full',       text: t('q2Option_preFull') },
    { id: 'pre_defer_stop', text: t('q2Option_preDeferStop') },
  ];

  const [state, setState] = useState<DemoState>(INITIAL_STATE);

  const updateState = (patch: Partial<DemoState>) =>
    setState((prev) => ({ ...prev, ...patch }));

  // ── Layer 0: 型選択 ───────────────────────────────────────────────────────
  const handleTypeSelect = (typeId: InvestmentTypeId) => {
    updateState({ selectedType: typeId, step: 'mandatory_conditions', error: '' });
  };

  // ── Layer 1: 必須3変数取得 ────────────────────────────────────────────────
  const handleMandatoryConditionsSubmit = (conditions: MandatoryConditions) => {
    updateState({ mandatoryConditions: conditions, step: 'q1', error: '' });
  };

  // ── Step 1: Q1 送信 → Q2 固定選択肢表示 ────────────────────────────────
  const handleQ1Submit = (q1: string) => {
    const q2Options =
      state.selectedType === 'pre_adoption' ? PRE_ADOPTION_Q2_OPTIONS : FIXED_Q2_OPTIONS;
    updateState({ step: 'q2', q1, q2Options, error: '' });
  };

  // ── Step 2: Q2 送信 → Layer 1-3 パイプライン実行 ───────────────────────
  const handleQ2Submit = async (q2: string, q2Id: string) => {
    updateState({ step: 'processing', q2, selectedQ2Id: q2Id, error: '' });

    try {
      const res = await fetch('/api/q2d-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q1: state.q1, q2 }),
      });

      if (!res.ok) throw new Error('Pipeline failed');
      const data: Q2DPipelineResult = await res.json();

      runReclassificationIfOther(state.q1, q2, state.mandatoryConditions.decisionRule);
      updateState({
        pipelineResult: data,
        additionalQuestionsNeeded: data.additionalQuestionsNeeded,
        additionalAnswers: {
          // responsibility_structure では owner を渡さない
          // → 本文観測で null になった場合、未確定として正しく露出させる
          // → それ以外の type は mandatoryConditions.owner でフォールバック
          owner: state.selectedType === 'responsibility_structure'
            ? undefined
            : state.mandatoryConditions.owner || undefined,
          timeHorizon: state.mandatoryConditions.timeHorizon || undefined,
          decisionRule: state.mandatoryConditions.decisionRule || undefined,
        },
        step: 'complete',
      });
    } catch {
      updateState({ step: 'q2', error: t('errorPipeline') });
    }
  };

  // ── Layer 0.5: other 再分類（fire-and-forget、失敗してもフローを止めない）────
  const runReclassificationIfOther = (q1: string, q2: string, additional: string) => {
    if (state.selectedType !== 'other') return;
    fetch('/api/reclassify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q1, q2, additional }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((result) => {
        if (result) updateState({ reclassificationResult: result });
      })
      .catch(() => {
        // 再分類失敗は reclassificationResult = null のまま継続
      });
  };

  // ── DC 再試行 ─────────────────────────────────────────────────────────────
  const handleRetryDC = () => {
    updateState({ step: 'complete' });
  };

  const isLoading = state.step === 'loading_q2' || state.step === 'processing';
  const typeQuestionKeys = resolveTypeQuestions(state.selectedType);
  const typeQuestions = {
    q1: t(typeQuestionKeys.q1 as Parameters<typeof t>[0]),
    q2: t(typeQuestionKeys.q2 as Parameters<typeof t>[0]),
  };

  const stepNumber = {
    type_select: 1,
    mandatory_conditions: 2,
    q1: 3,
    loading_q2: 3,
    q2: 4,
    processing: 4,
    complete: 5,
    dc_error: 5,
  }[state.step];

  const totalSteps = 5;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* ヘッダー */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{t('pageTitle')}</h1>
          {state.step !== 'complete' && state.step !== 'dc_error' && (
            <p className="mt-1 text-sm text-gray-400">
              {stepNumber} / {totalSteps}
            </p>
          )}
        </div>

        {/* カード */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
          {/* エラー表示 */}
          {state.error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
              {state.error}
            </div>
          )}

          {/* Layer 0: 型選択 */}
          {state.step === 'type_select' && (
            <TypeSelection onSubmit={handleTypeSelect} />
          )}

          {/* Layer 1: 必須3変数 */}
          {state.step === 'mandatory_conditions' && (
            <MandatoryConditionsForm onSubmit={handleMandatoryConditionsSubmit} />
          )}

          {/* Step 1: Q1 入力 */}
          {(state.step === 'q1' || state.step === 'loading_q2') && (
            <Step1
              onSubmit={handleQ1Submit}
              isLoading={isLoading}
              questionLabel={typeQuestions.q1}
            />
          )}

          {/* Step 2: Q2 選択 */}
          {(state.step === 'q2' || state.step === 'processing') && (
            <Step2
              q1={state.q1}
              options={state.q2Options}
              onSubmit={handleQ2Submit}
              isLoading={isLoading}
              questionLabel={typeQuestions.q2}
            />
          )}

          {/* 完了画面 */}
          {(state.step === 'complete' || state.step === 'dc_error') &&
            state.pipelineResult && (
              <CompleteScreen
                pipelineResult={state.pipelineResult}
                additionalAnswers={state.additionalAnswers}
                dcError={state.step === 'dc_error'}
                onRetryDC={handleRetryDC}
                isOtherType={state.selectedType === 'other'}
                reclassificationResult={state.reclassificationResult}
                mandatoryConditions={state.mandatoryConditions}
                selectedType={state.selectedType}
                selectedQ2Id={state.selectedQ2Id}
              />
            )}
        </div>
      </div>
    </div>
  );
}
