import { redirect } from 'next/navigation';

// /blocked → /ja/blocked へフォールバックリダイレクト
export default function BlockedPageFallback() {
  redirect('/ja/blocked');
}
