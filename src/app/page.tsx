import { redirect } from 'next/navigation';

// middleware の intlMiddleware が /→/ja/ にリダイレクトするが、
// 直接アクセスされた場合のフォールバック
export default function RootPage() {
  redirect('/ja');
}
