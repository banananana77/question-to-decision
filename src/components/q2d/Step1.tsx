'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface Step1Props {
  onSubmit: (q1: string) => void;
  isLoading: boolean;
  questionLabel?: string;
}

export function Step1({ onSubmit, isLoading, questionLabel }: Step1Props) {
  const t = useTranslations('q2d');
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) onSubmit(text.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-lg font-semibold text-gray-900 mb-3">
          {questionLabel ?? t('q1Label')}
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-900"
          placeholder={t('q1Placeholder')}
          disabled={isLoading}
        />
        <p className="mt-1 text-sm text-gray-400">{text.length} / 2000</p>
      </div>

      <button
        type="submit"
        disabled={!text.trim() || isLoading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
      >
        {isLoading ? t('analyzing') : t('q1Submit')}
      </button>
    </form>
  );
}
