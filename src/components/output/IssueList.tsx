'use client';

import { useTranslations } from 'next-intl';
import type { Issue } from '@/types/q2d';

interface IssueListProps {
  issues: Issue[];
}

export function IssueList({ issues }: IssueListProps) {
  const t = useTranslations('demo');

  if (issues.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">
        {t('issuesDetected', { count: issues.length })}
      </h2>

      <div className="space-y-3">
        {issues.map((issue, index) => (
          <div
            key={issue.id}
            className="bg-white border border-gray-200 rounded-lg p-4"
          >
            <div className="flex items-start">
              <span className="flex-shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-sm font-medium">
                {index + 1}
              </span>
              <div className="ml-3 flex-1">
                <p className="text-gray-900">{issue.text}</p>
                {issue.separatedFrom && issue.separatedFrom.length > 0 && (
                  <p className="mt-2 text-xs text-gray-500">
                    {t('separatedFrom', { ids: issue.separatedFrom.join(', ') })}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
