'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Q2Option } from '@/schemas/output.schema';

interface Step2Props {
  q1: string;
  options: Q2Option[];
  onSubmit: (q2: string, id: string) => void;
  isLoading: boolean;
  questionLabel?: string;
}

export function Step2({ options, onSubmit, isLoading, questionLabel }: Step2Props) {
  const t = useTranslations('q2d');
  const [selected, setSelected] = useState<string | null>(null);
  const [customText, setCustomText] = useState('');
  const isOther = selected === '__other__';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isOther) {
      const text = customText.trim();
      if (text) onSubmit(text, '__other__');
    } else {
      const opt = options.find((o) => o.id === selected);
      const text = opt?.text ?? selected ?? '';
      const id = opt?.id ?? selected ?? '';
      if (text) onSubmit(text, id);
    }
  };

  const canSubmit = isOther ? customText.trim().length > 0 : selected !== null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <p className="text-lg font-semibold text-gray-900 mb-4">{questionLabel ?? t('q2Label')}</p>

        <div className="space-y-3">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSelected(opt.id)}
              disabled={isLoading}
              className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                selected === opt.id
                  ? 'border-blue-600 bg-blue-50 text-blue-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {opt.text}
            </button>
          ))}

          {/* それ以外 */}
          <button
            type="button"
            onClick={() => setSelected('__other__')}
            disabled={isLoading}
            className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
              isOther
                ? 'border-blue-600 bg-blue-50 text-blue-900'
                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
            }`}
          >
            {t('q2Other')}
          </button>

          {isOther && (
            <input
              type="text"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder={t('q2OtherPlaceholder')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
              autoFocus
            />
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={!canSubmit || isLoading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
      >
        {isLoading ? t('processing') : t('q2Submit')}
      </button>

      {isLoading && (
        <div className="flex items-center justify-center space-x-2 text-blue-600">
          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm">{t('processingMessage')}</span>
        </div>
      )}
    </form>
  );
}
