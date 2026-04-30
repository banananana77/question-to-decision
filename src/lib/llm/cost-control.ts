import { DEMO_LIMITS, TOKEN_ESTIMATION } from '@/config/limits';
import { logger } from '@/lib/logging/logger';

export interface TokenEstimate {
  estimated: number;
  withinLimit: boolean;
  maxAllowed: number;
}

/**
 * テキストのトークン数を推定（日本語・英語混在対応）
 */
export function estimateTokens(text: string): number {
  // 簡易判定：日本語文字（ひらがな、カタカナ、漢字）の割合
  const japaneseChars = text.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g) || [];
  const totalChars = text.length;
  const japaneseRatio = japaneseChars.length / totalChars;

  // 日本語比率に応じて係数を調整
  const charsPerToken =
    japaneseRatio > 0.5
      ? TOKEN_ESTIMATION.CHARS_PER_TOKEN_JP
      : TOKEN_ESTIMATION.CHARS_PER_TOKEN_EN;

  const estimatedTokens = Math.ceil(
    (totalChars / charsPerToken) * TOKEN_ESTIMATION.SAFETY_MARGIN
  );

  return estimatedTokens;
}

/**
 * 入力テキストがトークン制限内かチェック
 */
export function checkTokenLimit(text: string): TokenEstimate {
  const estimated = estimateTokens(text);
  const maxAllowed = DEMO_LIMITS.MAX_TOKENS_PER_REQUEST;
  const withinLimit = estimated <= maxAllowed;

  if (!withinLimit) {
    logger.warn('Token limit exceeded', {
      estimated,
      maxAllowed,
      textLength: text.length,
    });
  }

  return {
    estimated,
    withinLimit,
    maxAllowed,
  };
}
