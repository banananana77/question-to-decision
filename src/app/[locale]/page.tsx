'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/navigation';

export default function LandingPage() {
  const t = useTranslations('landing');

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center space-y-8">
        <h1 className="text-4xl font-bold text-gray-900 whitespace-pre-line">{t('title')}</h1>

        <p className="text-xl text-gray-600">{t('subtitle')}</p>

        <div className="space-y-4">
          <p className="text-gray-700">{t('problem1')}</p>
          {t('problem2') && (
            <p className="text-gray-500 text-sm">{t('problem2')}</p>
          )}
        </div>

        <div className="pt-8">
          <Link
            href="/demo"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
          >
            {t('ctaButton')}
          </Link>
        </div>

        <p className="text-sm text-gray-500">{t('limitation')}</p>
      </div>
    </div>
  );
}
