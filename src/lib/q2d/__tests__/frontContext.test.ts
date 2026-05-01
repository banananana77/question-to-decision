/**
 * buildFrontContext の単体テスト
 *
 * 実行方法:
 *   npx tsx src/lib/q2d/__tests__/frontContext.test.ts
 */

import assert from 'node:assert/strict';
import { buildFrontContext } from '../frontContext';
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

const mc = { owner: 'CFO', timeHorizon: '次回ボード', budgetSource: 'IT予算' };

// ── selectedType === null ─────────────────────────────────────────────────────

console.log('\n[1] selectedType === null');

test('selectedType null → undefined を返す', () => {
  const result = buildFrontContext({ selectedType: null, reclassificationResult: null });
  assert.equal(result, undefined);
});

// ── selectedType が other 以外 ─────────────────────────────────────────────────

console.log('\n[2] selectedType が other 以外');

test('continuation → selectedType/effectiveType ともに continuation', () => {
  const result = buildFrontContext({
    selectedType: 'continuation',
    reclassificationResult: null,
    mandatoryConditions: mc,
  });
  assert.ok(result !== undefined);
  assert.equal(result.selectedType, 'continuation');
  assert.equal(result.effectiveType, 'continuation');
});

test('roi_interpretation → selectedType/effectiveType ともに roi_interpretation', () => {
  const result = buildFrontContext({
    selectedType: 'roi_interpretation',
    reclassificationResult: null,
    mandatoryConditions: mc,
  });
  assert.ok(result !== undefined);
  assert.equal(result.selectedType, 'roi_interpretation');
  assert.equal(result.effectiveType, 'roi_interpretation');
});

// ── selectedType === 'other' + 高信頼再分類 ────────────────────────────────────

console.log('\n[3] selectedType === other + 高信頼再分類');

test('confidence 0.8 + responsibility_structure → effectiveType が responsibility_structure', () => {
  const rc: ReclassificationResult = {
    suggestedType: 'responsibility_structure',
    confidence: 0.8,
    reasoning: 'clear ownership issue',
  };
  const result = buildFrontContext({ selectedType: 'other', reclassificationResult: rc, mandatoryConditions: mc });
  assert.ok(result !== undefined);
  assert.equal(result.selectedType, 'other');
  assert.equal(result.effectiveType, 'responsibility_structure');
});

test('confidence 0.7 (境界値) → effectiveType が suggestedType になる', () => {
  const rc: ReclassificationResult = {
    suggestedType: 'continuation',
    confidence: 0.7,
    reasoning: 'boundary case',
  };
  const result = buildFrontContext({ selectedType: 'other', reclassificationResult: rc, mandatoryConditions: mc });
  assert.ok(result !== undefined);
  assert.equal(result.effectiveType, 'continuation');
});

// ── selectedType === 'other' + 低信頼 / truly_other ───────────────────────────

console.log('\n[4] selectedType === other + 低信頼 / truly_other');

test('confidence 0.69 → effectiveType が other のまま', () => {
  const rc: ReclassificationResult = {
    suggestedType: 'responsibility_structure',
    confidence: 0.69,
    reasoning: 'not confident enough',
  };
  const result = buildFrontContext({ selectedType: 'other', reclassificationResult: rc, mandatoryConditions: mc });
  assert.ok(result !== undefined);
  assert.equal(result.effectiveType, 'other');
});

test('suggestedType truly_other → effectiveType が other のまま', () => {
  const rc: ReclassificationResult = {
    suggestedType: 'truly_other',
    confidence: 0.95,
    reasoning: 'genuinely other',
  };
  const result = buildFrontContext({ selectedType: 'other', reclassificationResult: rc, mandatoryConditions: mc });
  assert.ok(result !== undefined);
  assert.equal(result.effectiveType, 'other');
});

test('reclassificationResult null → effectiveType が other', () => {
  const result = buildFrontContext({ selectedType: 'other', reclassificationResult: null, mandatoryConditions: mc });
  assert.ok(result !== undefined);
  assert.equal(result.effectiveType, 'other');
});

// ── mandatoryConditions の保持 ────────────────────────────────────────────────

console.log('\n[5] mandatoryConditions の保持');

test('mandatoryConditions の値がそのまま保持される', () => {
  const result = buildFrontContext({
    selectedType: 'continuation',
    reclassificationResult: null,
    mandatoryConditions: mc,
  });
  assert.ok(result !== undefined);
  assert.deepEqual(result.mandatoryConditions, mc);
});

test('mandatoryConditions 省略時は空文字にフォールバック', () => {
  const result = buildFrontContext({ selectedType: 'continuation', reclassificationResult: null });
  assert.ok(result !== undefined);
  assert.deepEqual(result.mandatoryConditions, { owner: '', timeHorizon: '', budgetSource: '' });
});

test('mandatoryConditions の一部が undefined でも空文字になる', () => {
  const result = buildFrontContext({
    selectedType: 'continuation',
    reclassificationResult: null,
    mandatoryConditions: { owner: 'CEO' },
  });
  assert.ok(result !== undefined);
  assert.equal(result.mandatoryConditions.owner, 'CEO');
  assert.equal(result.mandatoryConditions.timeHorizon, '');
  assert.equal(result.mandatoryConditions.budgetSource, '');
});

// ── 混線バグ非再現確認（pre_adoption: timeHorizon / budgetSource）────────────────

console.log('\n[6] mandatoryConditions 混線バグ非再現確認');

test('pre_adoption: timeHorizon と budgetSource が独立して保持される', () => {
  const result = buildFrontContext({
    selectedType: 'pre_adoption',
    reclassificationResult: null,
    mandatoryConditions: {
      owner: 'CEO',
      timeHorizon: '次回経営会議まで',
      budgetSource: 'AI導入検討予算',
    },
  });
  assert.ok(result !== undefined);
  assert.equal(result.mandatoryConditions.owner, 'CEO');
  assert.equal(result.mandatoryConditions.timeHorizon, '次回経営会議まで');
  assert.equal(result.mandatoryConditions.budgetSource, 'AI導入検討予算');
  // 混線チェック: timeHorizon に budgetSource の文字列が混入していない
  assert.ok(
    !result.mandatoryConditions.timeHorizon.includes('AI導入検討予算'),
    `timeHorizon に budgetSource が混入: "${result.mandatoryConditions.timeHorizon}"`
  );
  assert.ok(
    !result.mandatoryConditions.budgetSource.includes('次回経営会議まで'),
    `budgetSource に timeHorizon が混入: "${result.mandatoryConditions.budgetSource}"`
  );
});

// ── select UI downstream 流通テスト ──────────────────────────────────────────

console.log('\n[7] select UI downstream 流通テスト');

test('カスタム入力値 "Q3第一週まで" がそのまま downstream に流れる', () => {
  const result = buildFrontContext({
    selectedType: 'continuation',
    reclassificationResult: null,
    mandatoryConditions: { owner: 'CFO', timeHorizon: 'Q3第一週まで', budgetSource: 'IT予算' },
  });
  assert.ok(result !== undefined);
  assert.equal(result.mandatoryConditions.timeHorizon, 'Q3第一週まで');
});

test('英語プリセット値 "By end of quarter" がそのまま downstream に流れる', () => {
  const result = buildFrontContext({
    selectedType: 'expansion',
    reclassificationResult: null,
    mandatoryConditions: { owner: 'CEO', timeHorizon: 'By end of quarter', budgetSource: 'R&D budget' },
  });
  assert.ok(result !== undefined);
  assert.equal(result.mandatoryConditions.timeHorizon, 'By end of quarter');
});

test('内部sentinel "__custom__" が timeHorizon に残っていない（コンポーネント防護の確認）', () => {
  // MandatoryConditionsForm は values.timeHorizon に CUSTOM_SENTINEL を格納しない設計。
  // 自然言語文字列のみ downstream に届く前提を確認する。
  const presetsAndCustom = [
    '次回経営会議まで',
    '今月末まで',
    '四半期末まで',
    '半期末まで',
    '年度内',
    'Q3第一週まで', // custom
    'By next management meeting',
    'By end of quarter',
    'Next board meeting, Q3', // custom
  ];
  for (const timeHorizon of presetsAndCustom) {
    const result = buildFrontContext({
      selectedType: 'continuation',
      reclassificationResult: null,
      mandatoryConditions: { owner: 'CFO', timeHorizon, budgetSource: 'IT予算' },
    });
    assert.ok(result !== undefined);
    assert.notEqual(
      result.mandatoryConditions.timeHorizon,
      '__custom__',
      `sentinel が漏洩: "${result.mandatoryConditions.timeHorizon}"`
    );
    assert.equal(result.mandatoryConditions.timeHorizon, timeHorizon);
  }
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
