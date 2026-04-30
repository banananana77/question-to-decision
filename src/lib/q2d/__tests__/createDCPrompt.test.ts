/**
 * createDCPrompt の単体テスト
 *
 * 実行方法:
 *   npx tsx src/lib/q2d/__tests__/createDCPrompt.test.ts
 */

import assert from 'node:assert/strict';
import { createDCPrompt } from '../createDCPrompt';
import { generateDCPrompt } from '../dc-prompt';
import { buildDCPromptParams } from '../dcPromptParams';
import type { Layer3Output, ExtractedConditions, AdditionalQuestionsNeeded, AdditionalAnswers } from '@/schemas/output.schema';
import type { ReclassificationResult } from '../reclassification';

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

// ── Fixtures ──────────────────────────────────────────────────────────────────

const layer3: Layer3Output = {
  problems: [{ id: 'p1', description: '停止判断ができていない', dependencies: [] }],
  tasks: [{ id: 't1', description: '責任者を固定する', dependencies: [] }],
  conversions: [{ problemId: 'p1', taskId: 't1', reasoning: '転換' }],
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

const baseInput = {
  q1: 'AI投資を継続すべきか判断できない',
  q2: '意思決定を明確にする',
  layer3,
  extractedConditions,
  additionalQuestionsNeeded,
  additionalAnswers,
  hasDependencies: false,
};

const mc = { owner: 'CFO', timeHorizon: '次回ボード', budgetSource: 'IT予算' };

// ── 戻り値の型と基本動作 ──────────────────────────────────────────────────────

console.log('\n[1] string を返す');

test('createDCPrompt が string を返す', () => {
  const result = createDCPrompt({ ...baseInput, selectedType: null, reclassificationResult: null });
  assert.equal(typeof result, 'string');
  assert.ok(result.length > 0);
});

// ── buildDCPromptParams 経由と同じ結果 ───────────────────────────────────────

console.log('\n[2] buildDCPromptParams → generateDCPrompt と同じ結果になる');

test('selectedType null: 直接呼び出しと同じ prompt', () => {
  const expected = generateDCPrompt(buildDCPromptParams({
    ...baseInput,
    selectedType: null,
    reclassificationResult: null,
  }));
  const actual = createDCPrompt({ ...baseInput, selectedType: null, reclassificationResult: null });
  assert.equal(actual, expected);
});

test('selectedType continuation: 直接呼び出しと同じ prompt', () => {
  const expected = generateDCPrompt(buildDCPromptParams({
    ...baseInput,
    selectedType: 'continuation',
    reclassificationResult: null,
    mandatoryConditions: mc,
  }));
  const actual = createDCPrompt({
    ...baseInput,
    selectedType: 'continuation',
    reclassificationResult: null,
    mandatoryConditions: mc,
  });
  assert.equal(actual, expected);
});

// ── frontContext ありケース ───────────────────────────────────────────────────

console.log('\n[3] frontContext ありケースでも従来と同じ prompt が返る');

test('selectedType responsibility_structure → Front Context が含まれる', () => {
  const result = createDCPrompt({
    ...baseInput,
    selectedType: 'responsibility_structure',
    reclassificationResult: null,
    mandatoryConditions: mc,
  });
  assert.ok(result.includes('【Front Context:'));
  assert.ok(result.includes('【Interpretation Guidance:'));
  assert.ok(result.includes('【Decision Premises:'));
});

test('高信頼再分類あり → effectiveType が suggestedType になった prompt が返る', () => {
  const rc: ReclassificationResult = {
    suggestedType: 'responsibility_structure',
    confidence: 0.85,
    reasoning: 'clear ownership issue',
  };
  const result = createDCPrompt({
    ...baseInput,
    selectedType: 'other',
    reclassificationResult: rc,
    mandatoryConditions: mc,
  });
  assert.ok(result.includes('responsibility_structure'));
  assert.ok(result.includes('責任者 / 停止権限 / owner不在の問題として優先的に読む'));
});

// ── selectedType null ─────────────────────────────────────────────────────────

console.log('\n[4] selectedType null でも従来どおり動く');

test('selectedType null → Section 1〜3 が含まれる', () => {
  const result = createDCPrompt({ ...baseInput, selectedType: null, reclassificationResult: null });
  assert.ok(result.includes('【Section 1:'));
  assert.ok(result.includes('【Section 2:'));
  assert.ok(result.includes('【Section 3:'));
});

test('selectedType null → Front Context は含まれない', () => {
  const result = createDCPrompt({ ...baseInput, selectedType: null, reclassificationResult: null });
  assert.ok(!result.includes('【Front Context:'));
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
