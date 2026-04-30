'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { AdditionalQuestionsNeeded, AdditionalAnswers } from '@/schemas/output.schema';

interface AdditionalQuestionsProps {
  needed: AdditionalQuestionsNeeded;
  onSubmit: (answers: AdditionalAnswers) => void;
  introText?: string;
}

export function AdditionalQuestions({ needed, onSubmit, introText }: AdditionalQuestionsProps) {
  const t = useTranslations('q2d');
  const [owner, setOwner] = useState('');
  const [timeHorizon, setTimeHorizon] = useState('');
  const [decisionRule, setDecisionRule] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      owner: needed.owner ? owner || undefined : undefined,
      timeHorizon: needed.timeHorizon ? timeHorizon || undefined : undefined,
      decisionRule: needed.decisionRule ? decisionRule || undefined : undefined,
    });
  };

  const hasAnyQuestion = needed.owner || needed.timeHorizon || needed.decisionRule;

  if (!hasAnyQuestion) {
    onSubmit({});
    return null;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <p className="text-sm text-gray-500">{introText ?? t('additionalIntro')}</p>

      {needed.owner && (
        <div>
          <label className="block text-base font-semibold text-gray-900 mb-2">
            {t('ownerQuestion')}
          </label>
          <input
            type="text"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder={t('ownerPlaceholder')}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      )}

      {needed.timeHorizon && (
        <div>
          <label className="block text-base font-semibold text-gray-900 mb-2">
            {t('timeQuestion')}
          </label>
          <input
            type="text"
            value={timeHorizon}
            onChange={(e) => setTimeHorizon(e.target.value)}
            placeholder={t('timePlaceholder')}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      )}

      {needed.decisionRule && (
        <div>
          <label className="block text-base font-semibold text-gray-900 mb-2">
            {t('ruleQuestion')}
          </label>
          <input
            type="text"
            value={decisionRule}
            onChange={(e) => setDecisionRule(e.target.value)}
            placeholder={t('rulePlaceholder')}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          {t('additionalSubmit')}
        </button>
        <button
          type="button"
          onClick={() => onSubmit({})}
          className="px-6 py-3 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-sm"
        >
          {t('additionalSkip')}
        </button>
      </div>
    </form>
  );
}
