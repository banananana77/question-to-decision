// DEMO版の制限値
export const DEMO_LIMITS = {
  MAX_REQUESTS_PER_DAY: parseInt(
    process.env.DEMO_MAX_REQUESTS_PER_DAY || '10',
    10
  ),
  MAX_INPUT_LENGTH: 2000, // 文字数
  MAX_TOKENS_PER_REQUEST: parseInt(
    process.env.DEMO_MAX_TOKENS_PER_REQUEST || '3000',
    10
  ),
  MAX_ISSUES: 3, // DEMO版は最大3論点
} as const;

// トークン推定係数（日本語）
export const TOKEN_ESTIMATION = {
  CHARS_PER_TOKEN_JP: 2, // 日本語：約2文字/token
  CHARS_PER_TOKEN_EN: 4, // 英語：約4文字/token
  SAFETY_MARGIN: 1.2, // 安全係数
} as const;

// Rate Limit設定
export const RATE_LIMIT = {
  WINDOW_MS: 24 * 60 * 60 * 1000, // 24時間
  MAX_REQUESTS: DEMO_LIMITS.MAX_REQUESTS_PER_DAY,
} as const;

// Bot検知設定
export const BOT_DETECTION = {
  MIN_REQUEST_INTERVAL_MS: 3000, // 3秒未満の連続リクエストは疑わしい
  SUSPICIOUS_USER_AGENTS: [
    'bot',
    'crawler',
    'spider',
    'scraper',
    'curl',
    'wget',
    'python-requests',
  ],
} as const;
