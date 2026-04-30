/**
 * generateDCPrompt の prompt 組み立てテスト
 *
 * 実行方法:
 *   npx tsx src/lib/q2d/__tests__/dc-prompt.test.ts
 */

import assert from 'node:assert/strict';
import { generateDCPrompt } from '../dc-prompt';
import type {
  Layer3Output,
  ExtractedConditions,
  AdditionalQuestionsNeeded,
  AdditionalAnswers,
} from '@/schemas/output.schema';
import type { FrontContext } from '../dc-prompt';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const layer3: Layer3Output = {
  problems: [{ id: 'p1', description: 'ROI未達が続いている', dependencies: [] }],
  tasks: [{ id: 't1', description: '投資継続の可否を判断する', dependencies: [] }],
  conversions: [{ problemId: 'p1', taskId: 't1', reasoning: '問題を課題に転換' }],
};

const extractedConditions: ExtractedConditions = {
  owner: null,
  timeHorizon: null,
  decisionRule: null,
};

const additionalQuestionsNeeded: AdditionalQuestionsNeeded = {
  owner: false,
  timeHorizon: false,
  decisionRule: false,
};

const additionalAnswers: AdditionalAnswers = {};

const baseParams = {
  q1: 'AI投資を継続すべきか判断できない',
  q2: '投資の意思決定を明確にする',
  layer3,
  extractedConditions,
  additionalQuestionsNeeded,
  additionalAnswers,
  hasDependencies: false,
};

const frontContextFull: FrontContext = {
  selectedType: 'other',
  effectiveType: 'responsibility_structure',
  mandatoryConditions: {
    owner: 'CFO',
    timeHorizon: '次回ボード',
    budgetSource: 'IT予算',
  },
};

const frontContextEmptyPremises: FrontContext = {
  selectedType: 'continuation',
  effectiveType: 'continuation',
  mandatoryConditions: {
    owner: '',
    timeHorizon: '',
    budgetSource: '',
  },
};

// ── Test runner ───────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${e instanceof Error ? e.message : e}`);
    failed++;
  }
}

// ── Test Case 1: frontContext なし ────────────────────────────────────────────

console.log('\n[1] frontContext なし');

test('【Front Context: が含まれない', () => {
  const prompt = generateDCPrompt(baseParams);
  assert.ok(!prompt.includes('【Front Context:'), 'Front Context block should be absent');
});

test('【Interpretation Guidance: が含まれない', () => {
  const prompt = generateDCPrompt(baseParams);
  assert.ok(!prompt.includes('【Interpretation Guidance:'), 'Guidance block should be absent');
});

test('【Decision Premises: が含まれない', () => {
  const prompt = generateDCPrompt(baseParams);
  assert.ok(!prompt.includes('【Decision Premises:'), 'Decision Premises block should be absent');
});

test('Section 1〜3 は従来どおり含まれる', () => {
  const prompt = generateDCPrompt(baseParams);
  assert.ok(prompt.includes('【Section 1:'), 'Section 1 should be present');
  assert.ok(prompt.includes('【Section 2:'), 'Section 2 should be present');
  assert.ok(prompt.includes('【Section 3:'), 'Section 3 should be present');
});

// ── Test Case 2: frontContext あり + premises あり ─────────────────────────────

console.log('\n[2] frontContext あり + premises あり');

test('【Front Context: が含まれる', () => {
  const prompt = generateDCPrompt({ ...baseParams, frontContext: frontContextFull });
  assert.ok(prompt.includes('【Front Context:'));
});

test('【Interpretation Guidance: が含まれる', () => {
  const prompt = generateDCPrompt({ ...baseParams, frontContext: frontContextFull });
  assert.ok(prompt.includes('【Interpretation Guidance:'));
});

test('【Decision Premises: が含まれる', () => {
  const prompt = generateDCPrompt({ ...baseParams, frontContext: frontContextFull });
  assert.ok(prompt.includes('【Decision Premises:'));
});

test('owner / timeHorizon / budgetSource の値が含まれる', () => {
  const prompt = generateDCPrompt({ ...baseParams, frontContext: frontContextFull });
  assert.ok(prompt.includes('CFO'));
  assert.ok(prompt.includes('次回ボード'));
  assert.ok(prompt.includes('IT予算'));
});

test('挿入順: frontContext → guidance → premises → Section 1', () => {
  const prompt = generateDCPrompt({ ...baseParams, frontContext: frontContextFull });
  const frontIndex = prompt.indexOf('【Front Context:');
  const guidanceIndex = prompt.indexOf('【Interpretation Guidance:');
  const premisesIndex = prompt.indexOf('【Decision Premises:');
  const section1Index = prompt.indexOf('【Section 1:');
  assert.ok(frontIndex >= 0, 'Front Context not found');
  assert.ok(guidanceIndex > frontIndex, 'Guidance should come after Front Context');
  assert.ok(premisesIndex > guidanceIndex, 'Decision Premises should come after Guidance');
  assert.ok(section1Index > premisesIndex, 'Section 1 should come after Decision Premises');
});

// ── Test Case 3: frontContext あり + premises 全空 ─────────────────────────────

console.log('\n[3] frontContext あり + premises 全空');

test('【Front Context: は含まれる', () => {
  const prompt = generateDCPrompt({ ...baseParams, frontContext: frontContextEmptyPremises });
  assert.ok(prompt.includes('【Front Context:'));
});

test('【Interpretation Guidance: は含まれる', () => {
  const prompt = generateDCPrompt({ ...baseParams, frontContext: frontContextEmptyPremises });
  assert.ok(prompt.includes('【Interpretation Guidance:'));
});

test('【Decision Premises: は含まれない', () => {
  const prompt = generateDCPrompt({ ...baseParams, frontContext: frontContextEmptyPremises });
  assert.ok(!prompt.includes('【Decision Premises:'), 'Decision Premises block should be absent when all empty');
});

// ── Test Case 4: effectiveType ヒント ─────────────────────────────────────────

console.log('\n[4] effectiveType ヒント');

test('responsibility_structure の type hint 文言が含まれる', () => {
  const prompt = generateDCPrompt({ ...baseParams, frontContext: frontContextFull });
  assert.ok(prompt.includes('責任者 / 停止権限 / owner不在の問題として優先的に読む'));
});

test('continuation の type hint 文言が含まれる', () => {
  const prompt = generateDCPrompt({ ...baseParams, frontContext: frontContextEmptyPremises });
  assert.ok(prompt.includes('継続 / 縮小 / 停止の判断として優先的に読む'));
});

test('roi_interpretation の type hint 文言が含まれる', () => {
  const ctx: FrontContext = {
    selectedType: 'roi_interpretation',
    effectiveType: 'roi_interpretation',
    mandatoryConditions: { owner: '', timeHorizon: '', budgetSource: '' },
  };
  const prompt = generateDCPrompt({ ...baseParams, frontContext: ctx });
  assert.ok(prompt.includes('ROI未達の解釈と比較基準の問題として優先的に読む'));
});

test('other の type hint 文言が含まれる', () => {
  const ctx: FrontContext = {
    selectedType: 'other',
    effectiveType: 'other',
    mandatoryConditions: { owner: '', timeHorizon: '', budgetSource: '' },
  };
  const prompt = generateDCPrompt({ ...baseParams, frontContext: ctx });
  assert.ok(prompt.includes('今止まっている判断を1つに絞る問題として優先的に読む'));
});

// ── Test Case 5: schema / 本文保全 ────────────────────────────────────────────

console.log('\n[5] schema / 本文保全');

test('frontContext なし: 主要セクション見出しが揃っている', () => {
  const prompt = generateDCPrompt(baseParams);
  assert.ok(prompt.includes('【Section 1:'));
  assert.ok(prompt.includes('【Section 2:'));
  assert.ok(prompt.includes('【Section 3:'));
  assert.ok(prompt.includes('【判断条件の構造化データ（raw）】'));
});

test('frontContext あり: 主要セクション見出しが揃っている', () => {
  const prompt = generateDCPrompt({ ...baseParams, frontContext: frontContextFull });
  assert.ok(prompt.includes('【Section 1:'));
  assert.ok(prompt.includes('【Section 2:'));
  assert.ok(prompt.includes('【Section 3:'));
  assert.ok(prompt.includes('【判断条件の構造化データ（raw）】'));
});

test('q1 / q2 の値が prompt に含まれる', () => {
  const prompt = generateDCPrompt(baseParams);
  assert.ok(prompt.includes(baseParams.q1));
  assert.ok(prompt.includes(baseParams.q2));
});

test('layer3.problems の description が含まれる', () => {
  const prompt = generateDCPrompt(baseParams);
  assert.ok(prompt.includes('ROI未達が続いている'));
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
