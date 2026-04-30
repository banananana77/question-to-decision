'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

const TYPE_IDS = [
  'continuation',
  'roi_interpretation',
  'expansion',
  'responsibility_structure',
  'pre_adoption',
  'other',
] as const;

export type InvestmentTypeId = (typeof TYPE_IDS)[number];

interface TypeSelectionProps {
  onSubmit: (typeId: InvestmentTypeId) => void;
}

export function TypeSelection({ onSubmit }: TypeSelectionProps) {
  const t = useTranslations('q2d');
  const [selected, setSelected] = useState<InvestmentTypeId | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selected) onSubmit(selected);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <p className="text-lg font-semibold text-gray-900 mb-4">
          {t('typeSelectIntro')}
        </p>
        <div className="space-y-3">
          {TYPE_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setSelected(id)}
              className={`w-full text-left px-4 py-4 rounded-lg border-2 transition-colors ${
                selected === id
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <p className={`font-medium ${selected === id ? 'text-blue-900' : 'text-gray-800'}`}>
                {t(`typeLabel_${id}` as `typeLabel_${InvestmentTypeId}`)}
              </p>
              <p className={`text-sm mt-0.5 ${selected === id ? 'text-blue-700' : 'text-gray-500'}`}>
                {t(`typeDescription_${id}` as `typeDescription_${InvestmentTypeId}`)}
              </p>
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={selected === null}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
      >
        {t('btnNext')}
      </button>
    </form>
  );
}
