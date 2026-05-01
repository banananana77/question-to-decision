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

export function MandatoryConditionsForm({ onSubmit }: MandatoryConditionsFormProps) {
  const t = useTranslations('q2d');
  const [values, setValues] = useState<MandatoryConditions>({
    owner: '',
    timeHorizon: '',
    budgetSource: '',
    decisionRule: '',
  });

  const allFilled = values.owner.trim() && values.timeHorizon.trim() && values.budgetSource.trim() && values.decisionRule.trim();

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

  const fields: Array<{ id: keyof MandatoryConditions; labelKey: string; placeholderKey: string }> = [
    { id: 'owner', labelKey: 'mandatoryOwnerLabel', placeholderKey: 'mandatoryOwnerPlaceholder' },
    { id: 'timeHorizon', labelKey: 'mandatoryTimeHorizonLabel', placeholderKey: 'mandatoryTimeHorizonPlaceholder' },
    { id: 'budgetSource', labelKey: 'mandatoryBudgetSourceLabel', placeholderKey: 'mandatoryBudgetSourcePlaceholder' },
    { id: 'decisionRule', labelKey: 'mandatoryDecisionRuleLabel', placeholderKey: 'mandatoryDecisionRulePlaceholder' },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <p className="text-lg font-semibold text-gray-900">
        {t('mandatoryIntro')}
      </p>

      <div className="space-y-4">
        {fields.map((field) => (
          <div key={field.id}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t(field.labelKey as Parameters<typeof t>[0])}
            </label>
            <input
              type="text"
              id={`mandatory-${field.id}`}
              name={`mandatory-${field.id}`}
              autoComplete="off"
              value={values[field.id]}
              onChange={(e) => setValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
              placeholder={t(field.placeholderKey as Parameters<typeof t>[0])}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            />
          </div>
        ))}
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
