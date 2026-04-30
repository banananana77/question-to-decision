'use client';

import { useTranslations } from 'next-intl';
import type { NotAskableReason } from '@/types/q2d';

interface NotAskableReasonBoxProps {
  reasons: NotAskableReason[];
}

export function NotAskableReasonBox({ reasons }: NotAskableReasonBoxProps) {
  const t = useTranslations('demo');
  const tCategories = useTranslations('categories');

  if (reasons.length === 0) {
    return null;
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-yellow-900 mb-4">
        {t('notAskableTitle')}
      </h3>

      <div className="space-y-3">
        {reasons.map((reason, index) => (
          <div key={index} className="flex items-start">
            <svg
              className="h-5 w-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <p className="font-medium text-yellow-900">
                {tCategories(reason.category)}
              </p>
              <p className="mt-1 text-sm text-yellow-800">{reason.description}</p>
              {reason.evidence && (
                <p className="mt-2 text-xs text-yellow-700 italic">
                  根拠: {reason.evidence}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-yellow-200">
        <p className="text-sm text-yellow-900">{t('notAskableContact')}</p>
      </div>
    </div>
  );
}
