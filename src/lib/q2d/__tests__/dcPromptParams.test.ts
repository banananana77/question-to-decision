/**
 * buildDCPromptParams の単体テスト
 *
 * 実行方法:
 *   npx tsx src/lib/q2d/__tests__/dcPromptParams.test.ts
 */

import assert from 'node:assert/strict';
import { buildDCPromptParams } from '../dcPromptParams';
import { generateDCPrompt } from '../dc-prompt';
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
  problems: [{ id: 'p1', description: '停止判断ができていない', issueId: 'i1' }],
  tasks: [{ id: 't1', description: '責任者を固定する', problemId: 'p1', issueId: 'i1' }],
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

// ── selectedType null ─────────────────────────────────────────────────────────

console.log('\n[1] selectedType null でも params が生成できる');

test('selectedType null → frontContext が undefined', () => {
  const params = buildDCPromptParams({ ...baseInput, selectedType: null, reclassificationResult: null });
  assert.equal(params.frontContext, undefined);
});

test('selectedType null → q1/q2 がそのまま保持される', () => {
  const params = buildDCPromptParams({ ...baseInput, selectedType: null, reclassificationResult: null });
  assert.equal(params.q1, baseInput.q1);
  assert.equal(params.q2, baseInput.q2);
});

// ── frontContext の生成 ────────────────────────────────────────────────────────

console.log('\n[2] frontContext が必要条件を満たすときに含まれる');

test('selectedType continuation → frontContext に selectedType/effectiveType が入る', () => {
  const params = buildDCPromptParams({
    ...baseInput,
    selectedType: 'continuation',
    reclassificationResult: null,
    mandatoryConditions: mc,
  });
  assert.ok(params.frontContext !== undefined);
  assert.equal(params.frontContext.selectedType, 'continuation');
  assert.equal(params.frontContext.effectiveType, 'continuation');
});

test('高信頼再分類あり → frontContext.effectiveType が suggestedType になる', () => {
  const rc: ReclassificationResult = {
    suggestedType: 'responsibility_structure',
    confidence: 0.85,
    reasoning: 'clear ownership issue',
  };
  const params = buildDCPromptParams({
    ...baseInput,
    selectedType: 'other',
    reclassificationResult: rc,
    mandatoryConditions: mc,
  });
  assert.ok(params.frontContext !== undefined);
  assert.equal(params.frontContext.selectedType, 'other');
  assert.equal(params.frontContext.effectiveType, 'responsibility_structure');
});

test('低信頼再分類 → frontContext.effectiveType が other のまま', () => {
  const rc: ReclassificationResult = {
    suggestedType: 'continuation',
    confidence: 0.5,
    reasoning: 'low confidence',
  };
  const params = buildDCPromptParams({
    ...baseInput,
    selectedType: 'other',
    reclassificationResult: rc,
    mandatoryConditions: mc,
  });
  assert.ok(params.frontContext !== undefined);
  assert.equal(params.frontContext.effectiveType, 'other');
});

// ── mandatoryConditions / core fields の保持 ──────────────────────────────────

console.log('\n[3] 各フィールドがそのまま保持される');

test('mandatoryConditions がそのまま frontContext に入る', () => {
  const params = buildDCPromptParams({
    ...baseInput,
    selectedType: 'continuation',
    reclassificationResult: null,
    mandatoryConditions: mc,
  });
  assert.ok(params.frontContext !== undefined);
  assert.deepEqual(params.frontContext.mandatoryConditions, mc);
});

test('layer3 / extractedConditions / additionalQuestionsNeeded がそのまま保持される', () => {
  const params = buildDCPromptParams({
    ...baseInput,
    selectedType: 'continuation',
    reclassificationResult: null,
  });
  assert.deepEqual(params.layer3, layer3);
  assert.deepEqual(params.extractedConditions, extractedConditions);
  assert.deepEqual(params.additionalQuestionsNeeded, additionalQuestionsNeeded);
});

test('hasDependencies がそのまま保持される', () => {
  const params = buildDCPromptParams({
    ...baseInput,
    selectedType: null,
    reclassificationResult: null,
    hasDependencies: true,
  });
  assert.equal(params.hasDependencies, true);
});

// ── generateDCPrompt() との統合 ───────────────────────────────────────────────

console.log('\n[4] 既存の generateDCPrompt() 呼び出し結果が変わらない');

test('frontContext なし: 直接渡しと buildDCPromptParams 経由で同じ prompt が生成される', () => {
  const directParams = {
    ...baseInput,
    frontContext: undefined,
  };
  const builtParams = buildDCPromptParams({
    ...baseInput,
    selectedType: null,
    reclassificationResult: null,
  });
  assert.equal(generateDCPrompt(directParams), generateDCPrompt(builtParams));
});

test('frontContext あり: Section 1〜3 が含まれる', () => {
  const params = buildDCPromptParams({
    ...baseInput,
    selectedType: 'responsibility_structure',
    reclassificationResult: null,
    mandatoryConditions: mc,
  });
  const prompt = generateDCPrompt(params);
  assert.ok(prompt.includes('【Section 1:'));
  assert.ok(prompt.includes('【Section 2:'));
  assert.ok(prompt.includes('【Section 3:'));
  assert.ok(prompt.includes('【Front Context:'));
  assert.ok(prompt.includes('【Decision Premises:'));
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
