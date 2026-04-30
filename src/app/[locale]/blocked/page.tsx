import { getTranslations } from 'next-intl/server';
import { Link } from '@/navigation';

export default async function BlockedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason = 'unknown' } = await searchParams;
  const t = await getTranslations('blocked');

  const messages: Record<string, string> = {
    rate_limit: t('rateLimitMessage'),
    bot_detected: t('botDetectedMessage'),
    unknown: t('unknownMessage'),
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
          <svg
            className="w-8 h-8 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>

        <p className="text-gray-600">{messages[reason]}</p>

        <div className="pt-4">
          <Link
            href="/"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            {t('backButton')}
          </Link>
        </div>

        <p className="text-sm text-gray-500">{t('contactNote')}</p>
      </div>
    </div>
  );
}
