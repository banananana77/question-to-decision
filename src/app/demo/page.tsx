import { redirect } from 'next/navigation';

// /demo → /ja/demo へフォールバックリダイレクト
// 通常は middleware の intlMiddleware が処理する
export default function DemoPageFallback() {
  redirect('/ja/demo');
}
