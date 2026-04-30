'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import type { Q2DPipelineResult, AdditionalAnswers } from '@/schemas/output.schema';
import type { ReclassificationResult } from '@/lib/q2d/reclassification';
import type { MandatoryConditions } from '@/components/q2d/MandatoryConditionsForm';
import type { InvestmentTypeId } from '@/lib/q2d/effectiveType';
import { resolveEffectiveType } from '@/lib/q2d/effectiveType';
import { createDCPrompt } from '@/lib/q2d/createDCPrompt';


interface CompleteScreenProps {
  pipelineResult: Q2DPipelineResult;
  additionalAnswers: AdditionalAnswers;
  dcError?: boolean;
  onRetryDC?: () => void;
  isOtherType?: boolean;
  reclassificationResult?: ReclassificationResult | null;
  mandatoryConditions?: MandatoryConditions;
  selectedType?: InvestmentTypeId | null;
  selectedQ2Id?: string;
}

// pre_adoption 専用: final 寄りの内部キーセット
const PRE_ADOPTION_FINAL_IDS = new Set([
  'pre_pilot',
  'pre_full',
  'pre_defer_stop',
]);

export function CompleteScreen({
  pipelineResult,
  additionalAnswers,
  dcError,
  onRetryDC,
  isOtherType,
  reclassificationResult,
  mandatoryConditions,
  selectedType,
  selectedQ2Id,
}: CompleteScreenProps) {
  // resolveEffectiveType は通常関数（hook ではない）ため useState より前に置いても問題なし
  // lazy initializer と本体の両方で同じ値を参照できるよう、先に一度だけ計算する
  const effectiveType = resolveEffectiveType({
    selectedType: selectedType ?? null,
    reclassificationResult: reclassificationResult ?? null,
  });

  const t = useTranslations('q2d');
  const locale = useLocale();
  const [dcLoading, setDcLoading] = useState(false);

  const sentCompleteRef = useRef(false);

  // fire-and-forget helper — never throws, never blocks UI
  const sendEvent = (payload: Record<string, unknown>) => {
    fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  };

  // complete_shown: 1回だけ送信
  useEffect(() => {
    if (sentCompleteRef.current) return;
    sentCompleteRef.current = true;
    sendEvent({
      eventType: 'complete_shown',
      locale,
      selectedType: selectedType ?? undefined,
      effectiveType,
      promptMode: isPreAdoption ? preViewMode : undefined,
      q1Length: q1.length,
      q2Length: q2.length,
      issueCount: pipelineResult.layer2.issues.length,
      reasonCount: pipelineResult.notAskableReasons.length,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // pre_adoption のみ: 4ページ目の選択肢 ID から初期表示モードを決定（effectiveType 基準）
  const [preViewMode, setPreViewMode] = useState<'intermediate' | 'final'>(() => {
    if (effectiveType === 'pre_adoption' && PRE_ADOPTION_FINAL_IDS.has(selectedQ2Id ?? '')) {
      return 'final';
    }
    return 'intermediate';
  });

  const { q1, q2, layer3, hasDependencies, additionalQuestionsNeeded } =
    pipelineResult;

  const tKey = (prefix: string) => t(`${prefix}_${effectiveType}` as Parameters<typeof t>[0]);

  // 専用レイアウト判定 — 各フラグが true のとき標準テキスト計算をスキップ
  const isRS = effectiveType === 'responsibility_structure';
  const isExpansion = effectiveType === 'expansion';
  const isPreAdoption = effectiveType === 'pre_adoption';

  const useStandardText = !isRS && !isExpansion && !isPreAdoption;
  const decisionUnitText = useStandardText ? tKey('decisionUnit') : '';
  const outOfScopeText = useStandardText ? tKey('outOfScope') : '';
  const nextInfoText = useStandardText ? tKey('nextInfo') : '';
  const reviewConditionText = useStandardText
    ? (mandatoryConditions?.timeHorizon
      ? t(`reviewCondition_${effectiveType}_with` as Parameters<typeof t>[0], { timeHorizon: mandatoryConditions.timeHorizon })
      : tKey('reviewCondition'))
    : '';

  const displayProblems = layer3.problems.slice(0, 4);

  const missingOwner = additionalQuestionsNeeded.owner && !additionalAnswers.owner;
  const missingTime = additionalQuestionsNeeded.timeHorizon && !additionalAnswers.timeHorizon;
  const missingRule = additionalQuestionsNeeded.decisionRule && !additionalAnswers.decisionRule;
  const hasMissing = missingOwner || missingTime || missingRule;

  // expansion: フォーム値フォールバックに関係なく、本文文脈で固定できたかを判定
  const shouldShowExpansionMissing =
    additionalQuestionsNeeded.owner ||
    additionalQuestionsNeeded.timeHorizon ||
    additionalQuestionsNeeded.decisionRule;

  const expansionMissingItems = [
    additionalQuestionsNeeded.owner && '最終判断者が未確定',
    additionalQuestionsNeeded.timeHorizon && '判断期限が未確定',
    additionalQuestionsNeeded.decisionRule && '拡大判断基準が未確定',
  ].filter(Boolean) as string[];

  // isRS は上で定義済み

  const handleCTA = async () => {
    const dcPrompt = createDCPrompt({
      selectedType: selectedType ?? null,
      reclassificationResult: reclassificationResult ?? null,
      mandatoryConditions,
      q1,
      q2,
      layer3,
      extractedConditions: pipelineResult.extractedConditions,
      additionalQuestionsNeeded,
      additionalAnswers,
      hasDependencies,
      promptMode: preViewMode,
    });

    // copy_clicked: プロンプト全文ではなく長さのみ送信
    sendEvent({
      eventType: 'copy_clicked',
      locale,
      selectedType: selectedType ?? undefined,
      effectiveType,
      promptMode: isPreAdoption ? preViewMode : undefined,
      promptLength: dcPrompt.length,
    });

    setDcLoading(true);
    try {
      await navigator.clipboard.writeText(dcPrompt);
      alert(t('dcCopied'));
    } catch {
      const el = document.createElement('textarea');
      el.value = dcPrompt;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      alert(t('dcCopied'));
    } finally {
      setDcLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* ヘッダー */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-4">
          <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900">{t('completeTitle')}</h2>
        <p className="mt-2 text-gray-600 text-sm whitespace-pre-line">{t('completeDescription')}</p>
      </div>

      {/* DCエラー通知 */}
      {dcError && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-800">{t('dcErrorTitle')}</p>
            <p className="text-sm text-amber-700 mt-1">{t('dcErrorMessage')}</p>
          </div>
        </div>
      )}

      {isRS ? (
        /* ──── responsibility_structure 専用レイアウト ──── */
        <>
          {/* 1. 今回固定すべき判断単位 */}
          {(mandatoryConditions || selectedType) && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">今回固定すべき判断単位</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm text-gray-800">
                {mandatoryConditions?.owner && (
                  <p><span className="font-medium">{t('mandatoryOwner')}:</span> {mandatoryConditions.owner}</p>
                )}
                {mandatoryConditions?.timeHorizon && (
                  <p><span className="font-medium">{t('mandatoryTimeHorizon')}:</span> {mandatoryConditions.timeHorizon}</p>
                )}
                {mandatoryConditions?.budgetSource && (
                  <p><span className="font-medium">{t('mandatoryBudgetSource')}:</span> {mandatoryConditions.budgetSource}</p>
                )}
                <p className="text-gray-700">{decisionUnitText}</p>
                <p className="text-xs text-gray-500 border-t border-gray-200 pt-2 mt-1">
                  今回の主論点は、投資合理性そのものより 誰が持ち、誰が止め、誰が運用するか の固定
                </p>
              </div>
            </section>
          )}

          {/* 2. 今回決めないこと */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">今回決めないこと</h3>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-700">
              {outOfScopeText}
            </div>
          </section>

          {/* 3. 次に固定すべき責任構造 */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">次に固定すべき責任構造</h3>
            <p className="text-sm text-gray-600">
              以下の4つの責任役割を固定することで、継続・見直し・停止の判断が実行可能になります。
            </p>
            <div className="space-y-3">
              {[
                {
                  role: '最終判断者（final owner）',
                  status: '現状：未確定',
                  content: '継続・見直し・停止の最終判断権、追加投資可否の最終承認権',
                },
                {
                  role: '停止権限者（stop authority）',
                  status: '現状：未確定',
                  content: '誰が「いったん止める」と宣言できるか、final owner と同一か別か',
                },
                {
                  role: '日常運用責任者（operational owner）',
                  status: '現状：未確定',
                  content: 'どの部署・役割が日常運用、改善実行、状況報告を担うか',
                },
                {
                  role: '役割分離（approval / use / oversight）',
                  status: '現状：未確認',
                  content: '承認する役割、利用する役割、監督する役割が分離されているか',
                },
              ].map((item) => (
                <div key={item.role} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-medium text-sm text-gray-800">{item.role}</span>
                    <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded whitespace-nowrap">
                      {item.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{item.content}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 4. 再判断条件 */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">再判断条件</h3>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4 text-sm">
              <div>
                <p className="font-medium text-gray-700 mb-2">何が揃えば再判断できるか</p>
                <ul className="space-y-1 text-gray-600">
                  {[
                    'final owner の指名が完了している',
                    'stop authority が確定している',
                    'operational owner が部署または役割レベルで明示されている',
                    '各役割の責任範囲が短文で文書化されている',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="text-gray-400 mt-0.5 flex-shrink-0">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-medium text-gray-700 mb-1">いつ再判断するか</p>
                <p className="text-gray-600">{mandatoryConditions?.timeHorizon || '次回経営会議'}</p>
              </div>
              <div>
                <p className="font-medium text-gray-700 mb-2">誰が再判断をトリガーするか</p>
                <ul className="space-y-1 text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400 mt-0.5 flex-shrink-0">•</span>
                    固定作業の主導：経営企画または事務局
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400 mt-0.5 flex-shrink-0">•</span>
                    最終再判断：{mandatoryConditions?.owner
                      ? `${mandatoryConditions.owner}（確定した final owner）`
                      : '確定した final owner'}
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* 5. 今回の状況要約 */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">今回の状況要約</h3>
            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-800 space-y-2">
              <p>{q1}</p>
              {q2 && q2 !== q1 && (
                <p className="text-gray-600 border-t border-gray-200 pt-2">{q2}</p>
              )}
            </div>
          </section>

          {/* 6. 確認された問題 */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">確認された問題</h3>
            <div className="space-y-2">
              {displayProblems.map((problem, i) => (
                <div key={problem.id} className="flex items-start gap-3 bg-white border border-gray-200 rounded-lg p-4">
                  <span className="flex-shrink-0 w-6 h-6 bg-red-100 text-red-700 rounded-full flex items-center justify-center text-sm font-medium">
                    {i + 1}
                  </span>
                  <p className="text-gray-800 text-sm">{problem.description}</p>
                </div>
              ))}
            </div>
            {hasDependencies && (
              <p className="text-xs text-gray-400">{t('dependencyNote')}</p>
            )}
          </section>

          {/* 7. 未確定の判断条件 */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">未確定の判断条件</h3>
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 space-y-2">
              {[
                '最終判断者が未確定',
                '停止権限者が未確定',
                '日常運用責任者が未確定',
                '役割分離の有無が未確認',
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-amber-800">
                  <span className="w-2 h-2 bg-amber-400 rounded-full flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </section>
        </>
      ) : isPreAdoption ? (
        /* ──── pre_adoption 専用レイアウト ──── */
        <>
          {/* 切り替えタブ */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm font-medium">
            <button
              type="button"
              onClick={() => setPreViewMode('intermediate')}
              className={`flex-1 py-2.5 px-4 transition-colors ${
                preViewMode === 'intermediate'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              基準から見る
            </button>
            <button
              type="button"
              onClick={() => setPreViewMode('final')}
              className={`flex-1 py-2.5 px-4 border-l border-gray-200 transition-colors ${
                preViewMode === 'final'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              導入判断から見る
            </button>
          </div>

          {/* 補助文 */}
          <p className="text-sm text-gray-600 text-center">
            {preViewMode === 'intermediate'
              ? '今回は、導入判断の基準整理から表示しています。'
              : '今回は、導入可否そのものを比較する判断面を表示しています。必要に応じて基準側にも戻れます。'}
          </p>

          {/* 今回の主論点 */}
          {q2 && (
            <div className="border border-gray-100 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs text-gray-500">今回の主論点</p>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                  {preViewMode === 'intermediate' ? '基準整理' : '導入判断'}
                </span>
              </div>
              <p className="text-sm text-gray-700">{q2}</p>
              <p className="text-sm text-gray-600 mt-1.5">
                {preViewMode === 'intermediate'
                  ? '今回の入力では、まず導入判断の基準整理から見るのが自然なため、この表示から始めています。'
                  : '今回の入力では、導入可否そのものの比較から見るのが自然なため、この表示から始めています。'}
              </p>
            </div>
          )}

          {preViewMode === 'intermediate' ? (
            /* ── 基準策定から見る（intermediate）── */
            <>
              {/* 1. 今回固定すべき判断単位 */}
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">今回の判断</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm text-gray-800">
                  {mandatoryConditions?.owner && (
                    <p><span className="font-medium">{t('mandatoryOwner')}:</span> {mandatoryConditions.owner}</p>
                  )}
                  {mandatoryConditions?.timeHorizon && (
                    <p><span className="font-medium">{t('mandatoryTimeHorizon')}:</span> {mandatoryConditions.timeHorizon}</p>
                  )}
                  {mandatoryConditions?.budgetSource && (
                    <p><span className="font-medium">{t('mandatoryBudgetSource')}:</span> {mandatoryConditions.budgetSource}</p>
                  )}
                  <p className="text-gray-700 pt-1">
                    {mandatoryConditions?.timeHorizon || '次回経営会議'}までに、AI本格導入の可否を判断するための基準を固める。
                  </p>
                  <p className="text-sm text-gray-600 border-t border-gray-200 pt-2 mt-1">
                    まずは、導入可否を判断するための基準整理を優先しています。
                  </p>
                </div>
              </section>

              {/* 2. この判断の採用条件 */}
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">この判断の採用条件</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-700">
                  <p className="text-gray-600 mb-2">以下が確認できれば、導入判断基準を固定する：</p>
                  <ul className="space-y-1.5">
                    {[
                      '導入候補の対象範囲が整理されている',
                      '優先順位の判断軸が定義されている',
                      '導入判断の条件が短文で明文化されている',
                      `${mandatoryConditions?.timeHorizon || '次回経営会議'}までに確認すべき事項が整理されている`,
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="text-gray-400 flex-shrink-0">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              {/* 3. 比較すべき判断面 */}
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">比較すべき判断面</h3>
                <p className="text-sm text-gray-600">
                  基準が既にある程度明確な場合は、「導入判断から見る」で導入可否の判断に進めます。
                </p>
                <div className="space-y-2">
                  {[
                    { label: '本格導入する',    typeLabel: '全面展開', hint: '対象範囲と優先順位が固まった後に比較する判断面' },
                    { label: '限定導入で進める', typeLabel: '限定検証', hint: '対象を絞って検証範囲を定める場合の判断面' },
                    { label: '判断を延期する',   typeLabel: '追加確認', hint: '追加で確認すべき条件が残る場合の判断面' },
                    { label: '今回は見送る',     typeLabel: '再配分',  hint: '他施策への再配分も含めて検討する場合の判断面' },
                  ].map(({ label, typeLabel, hint }) => (
                    <div key={label} className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-gray-800">{label}</span>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded whitespace-nowrap">{typeLabel}</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{hint}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* 4. 再判断条件 */}
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">再判断条件</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4 text-sm">
                  <div>
                    <p className="font-medium text-gray-700 mb-2">何が揃えば再判断できるか</p>
                    <ul className="space-y-1 text-gray-600">
                      {[
                        '導入判断基準が文書化されている',
                        '対象範囲と優先順位のたたき台がある',
                        '本格導入 / 限定導入 / 延期 / 見送り の比較条件が整理されている',
                      ].map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <span className="text-gray-400 mt-0.5 flex-shrink-0">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-gray-700 mb-1">いつ再判断するか</p>
                    <p className="text-gray-600">{mandatoryConditions?.timeHorizon || '次回経営会議'}</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-700 mb-2">誰が再判断をトリガーするか</p>
                    <ul className="space-y-1 text-gray-600">
                      <li className="flex items-start gap-2">
                        <span className="text-gray-400 mt-0.5 flex-shrink-0">•</span>
                        情報収集：経営企画または導入検討事務局
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-gray-400 mt-0.5 flex-shrink-0">•</span>
                        最終再判断：{mandatoryConditions?.owner || '未確定の最終判断者'}
                      </li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* 5. 今回決めないこと */}
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">今回決めないこと</h3>
                <p className="text-sm text-gray-600">
                  ここでは、今回の基準策定では扱わず、次の判断で比較すべき論点を分けて整理しています。
                </p>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-1.5 text-sm text-gray-700">
                  {[
                    { text: '本格導入の最終可否',      label: '導入判断' },
                    { text: '導入対象部門の最終確定',   label: '対象確定' },
                    { text: '投資額の最終決定',         label: '予算判断' },
                    { text: '詳細実装スケジュール',      label: '実行計画' },
                  ].map(({ text, label }) => (
                    <div key={text} className="flex items-center gap-2">
                      <span className="text-gray-400 flex-shrink-0">•</span>
                      <span className="flex-1">{text}</span>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded whitespace-nowrap">{label}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* 6. 状況要約 */}
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">状況要約</h3>
                <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-800 space-y-2">
                  <p>{q1}</p>
                  {q2 && q2 !== q1 && (
                    <p className="text-gray-600 border-t border-gray-200 pt-2">{q2}</p>
                  )}
                </div>
              </section>

              {/* 7. 確認された問題 */}
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">確認された問題</h3>
                <div className="space-y-2">
                  {displayProblems.map((problem, i) => (
                    <div key={problem.id} className="flex items-start gap-3 bg-white border border-gray-200 rounded-lg p-4">
                      <span className="flex-shrink-0 w-6 h-6 bg-red-100 text-red-700 rounded-full flex items-center justify-center text-sm font-medium">
                        {i + 1}
                      </span>
                      <p className="text-gray-800 text-sm">{problem.description}</p>
                    </div>
                  ))}
                </div>
                {hasDependencies && (
                  <p className="text-xs text-gray-400">{t('dependencyNote')}</p>
                )}
              </section>
            </>
          ) : (
            /* ── 導入可否判断から見る（final）── */
            <>
              {/* 1. 今回固定すべき判断単位 */}
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">今回固定すべき判断単位</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm text-gray-800">
                  {mandatoryConditions?.owner && (
                    <p><span className="font-medium">{t('mandatoryOwner')}:</span> {mandatoryConditions.owner}</p>
                  )}
                  {mandatoryConditions?.timeHorizon && (
                    <p><span className="font-medium">{t('mandatoryTimeHorizon')}:</span> {mandatoryConditions.timeHorizon}</p>
                  )}
                  {mandatoryConditions?.budgetSource && (
                    <p><span className="font-medium">{t('mandatoryBudgetSource')}:</span> {mandatoryConditions.budgetSource}</p>
                  )}
                  <p className="text-gray-700 pt-1">
                    {mandatoryConditions?.timeHorizon || '次回経営会議'}までに、AI本格導入 / 限定導入 / 判断延期 / 見送りのどれを採るかを比較可能な形で整理する。
                  </p>
                  <p className="text-sm text-gray-600 border-t border-gray-200 pt-2 mt-1">
                    ここでは、導入基準ではなく導入可否の判断面を表示します。
                  </p>
                </div>
              </section>

              {/* 2. 今回比較すべき判断面 */}
              {(() => {
                // selectedQ2Id から主候補カードキーを決定（該当なければ null）
                const primaryKey: string | null = (() => {
                  const id = selectedQ2Id ?? '';
                  if (id === 'pre_full') return '本格導入する';
                  if (id === 'pre_pilot') return '限定導入で進める';
                  return null;
                })();

                // 主候補の理由文（主候補カードにのみ表示）
                const primaryReasonMap: Record<string, string> = {
                  '本格導入する': '対象範囲や導入可否そのものを決めたい入力に近いため、この判断面を主候補として表示しています。',
                  '限定導入で進める': '対象を絞って進めたい入力に近いため、この判断面を主候補として表示しています。',
                  '判断を延期する': '条件整理や時期判断を優先したい入力に近いため、この判断面を主候補として表示しています。',
                  '今回は見送る': '再配分や見送り条件を優先したい入力に近いため、この判断面を主候補として表示しています。',
                };
                const primaryReason = primaryKey ? primaryReasonMap[primaryKey] ?? null : null;

                const cards = [
                  {
                    label: '本格導入する',
                    typeLabel: '全面展開',
                    subtitle: '導入対象範囲と優先順位が固まり、実行条件が確認できる場合',
                    tradeoff: '導入速度は上がるが、初期投資と実行負荷が大きい',
                    conditions: [
                      '導入対象範囲と優先順位が確定している',
                      '導入条件が明文化されている',
                      `${mandatoryConditions?.timeHorizon || '次回経営会議'}までに判断可能な材料が揃っている`,
                    ],
                  },
                  {
                    label: '限定導入で進める',
                    typeLabel: '限定検証',
                    subtitle: '対象部門や業務を限定し、検証範囲を定義して進める場合',
                    tradeoff: 'リスクは抑えられるが、全社効果の確認は遅れる',
                    conditions: [
                      '対象部門または対象業務を限定できている',
                      '検証範囲と確認方法が定義されている',
                      '全社導入の前提条件として位置づけられている',
                    ],
                  },
                  {
                    label: '判断を延期する',
                    typeLabel: '追加確認',
                    subtitle: '追加で確認すべき条件が残っており、次回判断へ持ち越す場合',
                    tradeoff: '判断精度は上がるが、機会損失が増える',
                    conditions: [
                      '追加検証項目が整理されている',
                      'いつまでに再判断するかが決まっている',
                      '延期の理由が明確になっている',
                    ],
                  },
                  {
                    label: '今回は見送る',
                    typeLabel: '再配分',
                    subtitle: '導入条件が固まらず、他施策への再配分を優先する場合',
                    tradeoff: '追加投資は抑えられるが、先行導入の機会を失う',
                    conditions: [
                      '導入条件が期限までに固まらない',
                      '他施策への再配分合理性が高い',
                      '今回導入しない条件が確認できている',
                    ],
                  },
                ];

                return (
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">今回比較すべき判断面</h3>
                    <p className="text-sm text-gray-600">
                      {primaryKey
                        ? '現在の入力では、主候補を1つ置いたうえで他の判断面と比較できるようにしています。'
                        : '現在の入力では、特定の主候補を置かずに4つの判断面を比較できるようにしています。'}
                    </p>
                    <div className="space-y-3">
                      {cards.map((opt) => {
                        const isPrimary = primaryKey === opt.label;
                        return (
                          <div
                            key={opt.label}
                            className={`rounded-lg p-4 ${
                              isPrimary
                                ? 'bg-blue-50 border-2 border-blue-300'
                                : 'bg-white border border-gray-200'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-0.5">
                              <p className={`font-medium text-sm ${isPrimary ? 'text-blue-800' : 'text-gray-800'}`}>
                                {opt.label}
                              </p>
                                {isPrimary ? (
                                <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded whitespace-nowrap">
                                  主候補
                                </span>
                              ) : (
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded whitespace-nowrap">
                                  {opt.typeLabel}
                                </span>
                              )}
                            </div>
                            {isPrimary && primaryReason && (
                              <p className="text-sm text-blue-700 mt-1 mb-1">{primaryReason}</p>
                            )}
                            <p className="text-sm text-gray-600 mt-0.5">{opt.subtitle}</p>
                            <p className="text-sm text-gray-500 mt-0.5 mb-2">{opt.tradeoff}</p>
                            <ul className="space-y-1 text-sm text-gray-600">
                              {opt.conditions.map((c) => (
                                <li key={c} className="flex items-start gap-2">
                                  <span className="text-gray-400 flex-shrink-0 mt-0.5">→</span>
                                  {c}
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })()}

              {/* 2. Trade-off */}
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Trade-off</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2 text-sm text-gray-700">
                  {[
                    '本格導入：判断と実行は早いが、初期投資と実行負荷が大きい',
                    '限定導入：リスクは抑えられるが、全社効果の確認は遅れる',
                    '判断延期：判断精度は上がるが、機会損失が増える',
                    '見送り：追加投資は抑えられるが、先行導入の機会を失う',
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2">
                      <span className="text-gray-400 flex-shrink-0">•</span>
                      {item}
                    </div>
                  ))}
                </div>
              </section>

              {/* 3. 今回決めないこと */}
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">今回決めないこと</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-1.5 text-sm text-gray-700">
                  {[
                    { text: '詳細な導入実装計画',    label: '実行計画' },
                    { text: 'ベンダー選定の最終決定', label: '調達判断' },
                    { text: '効果測定指標の詳細設計', label: '評価設計' },
                    { text: '運用体制の細部設計',    label: '運用設計' },
                  ].map(({ text, label }) => (
                    <div key={text} className="flex items-center gap-2">
                      <span className="text-gray-400 flex-shrink-0">•</span>
                      <span className="flex-1">{text}</span>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded whitespace-nowrap">{label}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* 4. 再判断条件 */}
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">再判断条件</h3>
                <p className="text-sm text-gray-600">
                  ここでは、今回決めきれない場合に次の判断へ進むための条件を整理しています。
                </p>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4 text-sm">
                  <div>
                    <p className="font-medium text-gray-700 mb-2">何が揃えば再判断できるか</p>
                    <ul className="space-y-1 text-gray-600">
                      {[
                        '導入 / 限定導入 / 延期 / 見送り の比較条件が整理されている',
                        '導入対象範囲と優先順位の案が揃っている',
                        '判断主体が確認されている',
                      ].map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <span className="text-gray-400 mt-0.5 flex-shrink-0">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-gray-700 mb-1">いつ再判断するか</p>
                    <p className="text-gray-600">{mandatoryConditions?.timeHorizon || '次回経営会議'}</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-700 mb-2">誰が再判断をトリガーするか</p>
                    <ul className="space-y-1 text-gray-600">
                      <li className="flex items-start gap-2">
                        <span className="text-gray-400 mt-0.5 flex-shrink-0">•</span>
                        情報収集：経営企画または導入検討事務局
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-gray-400 mt-0.5 flex-shrink-0">•</span>
                        最終再判断：{mandatoryConditions?.owner || '未確定の最終判断者'}
                      </li>
                    </ul>
                  </div>
                </div>
              </section>
            </>
          )}
        </>
      ) : isExpansion ? (
        /* ──── expansion 専用レイアウト ──── */
        <>
          {/* 1. 今回固定すべき判断単位 */}
          {(mandatoryConditions || selectedType) && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">今回固定すべき判断単位</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm text-gray-800">
                {mandatoryConditions?.owner && (
                  <p><span className="font-medium">{t('mandatoryOwner')}:</span> {mandatoryConditions.owner}</p>
                )}
                {mandatoryConditions?.timeHorizon && (
                  <p><span className="font-medium">{t('mandatoryTimeHorizon')}:</span> {mandatoryConditions.timeHorizon}</p>
                )}
                {mandatoryConditions?.budgetSource && (
                  <p><span className="font-medium">{t('mandatoryBudgetSource')}:</span> {mandatoryConditions.budgetSource}</p>
                )}
                <p className="text-gray-700">{decisionUnitText}</p>
              </div>
            </section>
          )}

          {/* 2. 今回決めないこと */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">今回決めないこと</h3>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-1.5 text-sm text-gray-700">
              {[
                '追加投資の最終金額',
                '全社展開の最終実行タイミング',
                '効果測定指標の詳細設計',
                '他施策への最終的な予算再配分',
              ].map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <span className="text-gray-400 flex-shrink-0">•</span>
                  {item}
                </div>
              ))}
            </div>
          </section>

          {/* 3. 比較すべき判断面 */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">比較すべき判断面</h3>
            <div className="space-y-3">
              {[
                {
                  label: '拡大する',
                  conditions: [
                    '追加投資の対象・金額・実施範囲が具体化されている',
                    '拡大後の効果確認方法が定義されている',
                    '他施策と比べてこの投資を優先する合理性が確認できる',
                  ],
                },
                {
                  label: '限定範囲で継続する',
                  conditions: [
                    '全社展開は止める',
                    '既存部門での運用は維持する',
                    '追加投資は限定的な範囲に絞る',
                    'FAQ / ログ / 運用知見など既存資産を残し、後続判断に使える状態にする',
                  ],
                },
                {
                  label: '追加投資を止める',
                  conditions: [
                    `${mandatoryConditions?.timeHorizon || '期限'}までに拡大判断基準が定義できない`,
                    '追加投資の合理性が他施策に劣る',
                    '全社展開しても主要目的に届かないことが確認される',
                  ],
                },
                {
                  label: '他施策へ再配分する',
                  conditions: [
                    '既存資産の再利用可能範囲が整理されている',
                    'この拡大投資より再配分先の合理性が高いことが確認される',
                  ],
                },
              ].map((opt) => (
                <div key={opt.label} className="bg-white border border-gray-200 rounded-lg p-4">
                  <p className="font-medium text-sm text-gray-800 mb-2">{opt.label}</p>
                  <p className="text-xs text-gray-500 mb-1.5">採用条件</p>
                  <ul className="space-y-1 text-sm text-gray-600">
                    {opt.conditions.map((c) => (
                      <li key={c} className="flex items-start gap-2">
                        <span className="text-gray-400 flex-shrink-0 mt-0.5">→</span>
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* 4. trade-off */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Trade-off</h3>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2 text-sm text-gray-700">
              {[
                '拡大：機会損失を抑えられる一方、追加投資と評価設計の負担が増える',
                '限定継続：既存資産を保持できる一方、全社効果の機会は先送りになる',
                '追加投資停止：追加コストは抑えられる一方、既存成果の拡張余地を失う',
                '再配分：他施策への転用余地は生まれるが、現運用知見を部分的に切り離す必要がある',
              ].map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <span className="text-gray-400 flex-shrink-0">•</span>
                  {item}
                </div>
              ))}
            </div>
          </section>

          {/* 5. 再判断条件 */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">再判断条件</h3>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4 text-sm">
              <div>
                <p className="font-medium text-gray-700 mb-2">何が揃えば再判断できるか</p>
                <ul className="space-y-1 text-gray-600">
                  {[
                    '拡大判断基準が文書化されている',
                    '追加投資の対象・規模・実施範囲が具体化されている',
                    '効果確認方法が定義されている',
                    `最終判断者が確認されている（現状: ${mandatoryConditions?.owner || '未確定'}）`,
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="text-gray-400 mt-0.5 flex-shrink-0">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-medium text-gray-700 mb-1">いつ再判断するか</p>
                <p className="text-gray-600">{mandatoryConditions?.timeHorizon || '次回経営会議'}</p>
              </div>
              <div>
                <p className="font-medium text-gray-700 mb-2">誰が再判断をトリガーするか</p>
                <ul className="space-y-1 text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400 mt-0.5 flex-shrink-0">•</span>
                    情報収集：経営企画または担当事務局
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400 mt-0.5 flex-shrink-0">•</span>
                    最終再判断：{mandatoryConditions?.owner || '未確定の最終判断者'}
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* 6. 今回の状況要約 */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">今回の状況要約</h3>
            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-800 space-y-2">
              <p>{q1}</p>
              {q2 && q2 !== q1 && (
                <p className="text-gray-600 border-t border-gray-200 pt-2">{q2}</p>
              )}
            </div>
          </section>

          {/* 7. 確認された問題 */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">確認された問題</h3>
            <div className="space-y-2">
              {displayProblems.map((problem, i) => (
                <div key={problem.id} className="flex items-start gap-3 bg-white border border-gray-200 rounded-lg p-4">
                  <span className="flex-shrink-0 w-6 h-6 bg-red-100 text-red-700 rounded-full flex items-center justify-center text-sm font-medium">
                    {i + 1}
                  </span>
                  <p className="text-gray-800 text-sm">{problem.description}</p>
                </div>
              ))}
            </div>
            {hasDependencies && (
              <p className="text-xs text-gray-400">{t('dependencyNote')}</p>
            )}
          </section>

          {/* 8. 未確定の判断条件（additionalQuestionsNeeded ベース: フォーム値に関係なく本文文脈で判定） */}
          {shouldShowExpansionMissing && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">未確定の判断条件</h3>
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 space-y-2">
                {expansionMissingItems.map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-amber-800">
                    <span className="w-2 h-2 bg-amber-400 rounded-full flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        /* ──── 標準レイアウト（responsibility_structure 以外） ──── */
        <>
          {/* 判断前提 */}
          {(mandatoryConditions || selectedType) && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{t('sectionMandatoryConditions')}</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm text-gray-800">
                {mandatoryConditions?.owner && (
                  <p><span className="font-medium">{t('mandatoryOwner')}:</span> {mandatoryConditions.owner}</p>
                )}
                {mandatoryConditions?.timeHorizon && (
                  <p><span className="font-medium">{t('mandatoryTimeHorizon')}:</span> {mandatoryConditions.timeHorizon}</p>
                )}
                {mandatoryConditions?.budgetSource && (
                  <p><span className="font-medium">{t('mandatoryBudgetSource')}:</span> {mandatoryConditions.budgetSource}</p>
                )}
                {mandatoryConditions?.decisionRule && (
                  <p>
                    <span className="font-medium">{t('mandatoryDecisionRule')}:</span>{' '}
                    {mandatoryConditions.decisionRule}
                  </p>
                )}
                {selectedType && (
                  <p><span className="font-medium">{t('sectionDecisionUnit')}:</span> {decisionUnitText}</p>
                )}
              </div>
            </section>
          )}

          {/* 今回は決めないこと */}
          {selectedType && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{t('sectionOutOfScope')}</h3>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-700">
                {outOfScopeText}
              </div>
            </section>
          )}

          {/* 次に確認すべき情報 */}
          {selectedType && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{t('sectionNextInfo')}</h3>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-700">
                {nextInfoText}
              </div>
            </section>
          )}

          {/* 再判断の条件 */}
          {selectedType && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{t('sectionReviewCondition')}</h3>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-700">
                {reviewConditionText}
              </div>
            </section>
          )}

          {/* 状況の詳細 */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{t('sectionQ1')}</h3>
            <div className="bg-gray-50 rounded-lg p-4 text-gray-800">{q1}</div>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{t('sectionQ2')}</h3>
            <div className="bg-gray-50 rounded-lg p-4 text-gray-800">{q2}</div>
          </section>

          {/* 確認された問題 */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              {t('sectionProblems')}
            </h3>
            <div className="space-y-2">
              {displayProblems.map((problem, i) => (
                <div key={problem.id} className="flex items-start gap-3 bg-white border border-gray-200 rounded-lg p-4">
                  <span className="flex-shrink-0 w-6 h-6 bg-red-100 text-red-700 rounded-full flex items-center justify-center text-sm font-medium">
                    {i + 1}
                  </span>
                  <p className="text-gray-800 text-sm">{problem.description}</p>
                </div>
              ))}
            </div>
            {hasDependencies && (
              <p className="text-xs text-gray-400">{t('dependencyNote')}</p>
            )}
          </section>

          {/* 未確定の判断条件 */}
          {hasMissing && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                {t('sectionMissingConditions')}
              </h3>
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 space-y-2">
                {missingOwner && (
                  <div className="flex items-center gap-2 text-sm text-amber-800">
                    <span className="w-2 h-2 bg-amber-400 rounded-full" />
                    {t('missingOwner')}
                  </div>
                )}
                {missingTime && (
                  <div className="flex items-center gap-2 text-sm text-amber-800">
                    <span className="w-2 h-2 bg-amber-400 rounded-full" />
                    {t('missingTime')}
                  </div>
                )}
                {missingRule && (
                  <div className="flex items-center gap-2 text-sm text-amber-800">
                    <span className="w-2 h-2 bg-amber-400 rounded-full" />
                    {t('missingRule')}
                  </div>
                )}
              </div>
            </section>
          )}
        </>
      )}

      {/* CTA */}
      <div className="pt-2">
        <button
          onClick={dcError && onRetryDC ? onRetryDC : handleCTA}
          disabled={dcLoading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-lg transition-colors text-base"
        >
          {dcLoading ? t('dcLoading') : dcError ? t('dcRetry') : t('ctaButton')}
        </button>
      </div>

      {/* 再分類結果（selectedType=other かつ結果あり の場合のみ） */}
      {isOtherType && reclassificationResult && (
        <section className="mt-6 pt-6 border-t border-gray-100 space-y-2 text-sm text-gray-500">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Reclassification Result
          </h3>
          <p>
            <span className="font-medium text-gray-600">Suggested Type:</span>{' '}
            {reclassificationResult.suggestedType}
          </p>
          <p>
            <span className="font-medium text-gray-600">Confidence:</span>{' '}
            {reclassificationResult.confidence.toFixed(2)}
          </p>
          <p>
            <span className="font-medium text-gray-600">Reasoning:</span>{' '}
            {reclassificationResult.reasoning}
          </p>
        </section>
      )}
    </div>
  );
}
