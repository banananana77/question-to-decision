'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

export interface MandatoryConditions {
  owner: string;
  timeHorizon: string;
  budgetSource: string;
  decisionRule: string;
}

interface MandatoryConditionsFormProps {
  onSubmit: (conditions: MandatoryConditions) => void;
}

// Preset option translation keys (order = display order)
const TIME_HORIZON_OPTION_KEYS = [
  'mandatoryTimeHorizonOption_nextMeeting',
  'mandatoryTimeHorizonOption_endOfMonth',
  'mandatoryTimeHorizonOption_endOfQuarter',
  'mandatoryTimeHorizonOption_endOfHalfYear',
  'mandatoryTimeHorizonOption_withinFiscalYear',
] as const;

// Internal sentinel — never stored in values.timeHorizon
const CUSTOM_SENTINEL = '__custom__';

export function MandatoryConditionsForm({ onSubmit }: MandatoryConditionsFormProps) {
  const t = useTranslations('q2d');
  const [values, setValues] = useState<MandatoryConditions>({
    owner: '',
    timeHorizon: '',
    budgetSource: '',
    decisionRule: '',
  });
  // Tracks the <select> selection: '' | preset text | CUSTOM_SENTINEL
  const [timeHorizonSelectValue, setTimeHorizonSelectValue] = useState('');

  const isCustom = timeHorizonSelectValue === CUSTOM_SENTINEL;

  const allFilled =
    values.owner.trim() &&
    values.timeHorizon.trim() &&
    values.budgetSource.trim() &&
    values.decisionRule.trim();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (allFilled) {
      onSubmit({
        owner: values.owner.trim(),
        timeHorizon: values.timeHorizon.trim(),
        budgetSource: values.budgetSource.trim(),
        decisionRule: values.decisionRule.trim(),
      });
    }
  };

  const handleTimeHorizonSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    setTimeHorizonSelectValue(selected);
    if (selected !== CUSTOM_SENTINEL) {
      // Preset: store the natural-language text directly in state
      setValues((prev) => ({ ...prev, timeHorizon: selected }));
    } else {
      // Custom: clear until user types something
      setValues((prev) => ({ ...prev, timeHorizon: '' }));
    }
  };

  const inputClass =
    'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900';
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <p className="text-lg font-semibold text-gray-900">
        {t('mandatoryIntro')}
      </p>

      <div className="space-y-4">
        {/* owner */}
        <div>
          <label htmlFor="mandatory-owner" className={labelClass}>
            {t('mandatoryOwnerLabel')}
          </label>
          <input
            type="text"
            id="mandatory-owner"
            name="mandatory-owner"
            autoComplete="off"
            value={values.owner}
            onChange={(e) => setValues((prev) => ({ ...prev, owner: e.target.value }))}
            placeholder={t('mandatoryOwnerPlaceholder')}
            className={inputClass}
          />
        </div>

        {/* timeHorizon: select + optional custom input */}
        <div>
          <label htmlFor="mandatory-timeHorizon" className={labelClass}>
            {t('mandatoryTimeHorizonLabel')}
          </label>
          <select
            id="mandatory-timeHorizon"
            name="mandatory-timeHorizon"
            value={timeHorizonSelectValue}
            onChange={handleTimeHorizonSelect}
            className={`${inputClass} bg-white`}
          >
            <option value="" disabled>
              {t('mandatoryTimeHorizonPlaceholder')}
            </option>
            {TIME_HORIZON_OPTION_KEYS.map((key) => {
              const text = t(key as Parameters<typeof t>[0]);
              return (
                <option key={key} value={text}>
                  {text}
                </option>
              );
            })}
            <option value={CUSTOM_SENTINEL}>
              {t('mandatoryTimeHorizonOption_custom')}
            </option>
          </select>

          {isCustom && (
            <input
              type="text"
              id="mandatory-timeHorizon-custom"
              name="mandatory-timeHorizon-custom"
              autoComplete="off"
              value={values.timeHorizon}
              onChange={(e) => setValues((prev) => ({ ...prev, timeHorizon: e.target.value }))}
              placeholder={t('mandatoryTimeHorizonCustomPlaceholder')}
              className={`mt-2 ${inputClass}`}
            />
          )}
        </div>

        {/* budgetSource */}
        <div>
          <label htmlFor="mandatory-budgetSource" className={labelClass}>
            {t('mandatoryBudgetSourceLabel')}
          </label>
          <input
            type="text"
            id="mandatory-budgetSource"
            name="mandatory-budgetSource"
            autoComplete="off"
            value={values.budgetSource}
            onChange={(e) => setValues((prev) => ({ ...prev, budgetSource: e.target.value }))}
            placeholder={t('mandatoryBudgetSourcePlaceholder')}
            className={inputClass}
          />
        </div>

        {/* decisionRule */}
        <div>
          <label htmlFor="mandatory-decisionRule" className={labelClass}>
            {t('mandatoryDecisionRuleLabel')}
          </label>
          <input
            type="text"
            id="mandatory-decisionRule"
            name="mandatory-decisionRule"
            autoComplete="off"
            value={values.decisionRule}
            onChange={(e) => setValues((prev) => ({ ...prev, decisionRule: e.target.value }))}
            placeholder={t('mandatoryDecisionRulePlaceholder')}
            className={inputClass}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={!allFilled}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
      >
        {t('btnNext')}
      </button>
    </form>
  );
}
