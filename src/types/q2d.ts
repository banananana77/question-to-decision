// Supported UI locales — extend here if new locales are added
export type SupportedLocale = 'ja' | 'en';

// Layer1〜3の出力型定義

export type EvidenceStatus = 'explicit' | 'strong_implication' | 'inference';

export interface Issue {
  id: string;
  text: string;
  sourceInput: string;
  separatedFrom?: string[]; // 分離元の論点ID
}

export interface Problem {
  id: string;
  description: string; // 現象記述
  issueId: string; // 元論点への参照
}

export interface Task {
  id: string;
  description: string; // 判断対象
  problemId: string; // 問題への参照
  issueId: string;
}

export interface NotAskableReason {
  category: 'owner_unclear' | 'time_horizon_missing' | 'decision_rule_ambiguous' | 'mixed_issues';
  description: string;
  evidence?: string; // 入力テキストからの根拠
}

// Layer1 出力
export interface Layer1Output {
  isMixed: boolean;
  reasoning: string;
  issueCount: number;
}

// Layer2 出力
export interface Layer2Output {
  issues: Issue[];
  dependencies: Array<{
    from: string; // issue ID
    to: string;   // issue ID
    type: 'prerequisite' | 'related';
  }>;
}

// Layer3 出力
export interface Layer3Output {
  problems: Problem[];
  tasks: Task[];
  conversions: Array<{
    problemId: string;
    taskId: string;
    reasoning: string;
  }>;
}

// 統合出力（Layer1〜3）
export interface Q2DResult {
  layer1: Layer1Output;
  layer2: Layer2Output;
  layer3: Layer3Output;
  notAskableReasons: NotAskableReason[];
}

// Usage記録用
export interface UsageRecord {
  fingerprint: string;
  requestCount: number;
  lastRequestAt: Date;
}
