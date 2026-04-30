/**
 * dc-prompt.ts の純粋関数の回帰テスト
 *
 * 実行方法:
 *   npx tsx src/lib/q2d/__tests__/dc-conditions.test.ts
 */

import assert from 'node:assert/strict';
import {
  resolveToNullable,
  normalizeConditions,
  toDisplayValue,
  buildUnresolvedPoints,
  buildRawPayload,
  assertConditionInvariants,
} from '../dc-prompt';

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

// ── resolveToNullable ──────────────────────────────────────────────────────────

console.log('\nresolveToNullable');

test('needed=false かつ extracted あり → extracted を返す', () => {
  assert.equal(resolveToNullable(false, '今月末', undefined), '今月末');
});

test('needed=false かつ extracted=null → null を返す（null を維持）', () => {
  assert.equal(resolveToNullable(false, null, undefined), null);
});

test('needed=true かつ userAnswer あり → userAnswer を返す', () => {
  assert.equal(resolveToNullable(true, null, 'CEO'), 'CEO');
});

test('needed=true かつ userAnswer なし → null を返す（未確定）', () => {
  assert.equal(resolveToNullable(true, null, undefined), null);
});

test('needed=true かつ userAnswer="" → null を返す（空文字は未確定扱い）', () => {
  assert.equal(resolveToNullable(true, null, ''), null);
});

// ── normalizeConditions ────────────────────────────────────────────────────────

console.log('\nnormalizeConditions');

test('テストケース1: 全て null（全未確定）', () => {
  const result = normalizeConditions(
    { owner: null, timeHorizon: null, decisionRule: null },
    { owner: true, timeHorizon: true, decisionRule: true },
    {}
  );
  assert.deepEqual(result, { owner: null, timeHorizon: null, decisionRule: null });
});

test('テストケース2: timeHorizon のみ確定', () => {
  const result = normalizeConditions(
    { owner: null, timeHorizon: '2週間後', decisionRule: null },
    { owner: true, timeHorizon: false, decisionRule: true },
    {}
  );
  assert.deepEqual(result, { owner: null, timeHorizon: '2週間後', decisionRule: null });
});

test('テストケース3: 全て確定', () => {
  const result = normalizeConditions(
    { owner: 'CEO', timeHorizon: '今月末', decisionRule: 'ROI' },
    { owner: false, timeHorizon: false, decisionRule: false },
    {}
  );
  assert.deepEqual(result, { owner: 'CEO', timeHorizon: '今月末', decisionRule: 'ROI' });
});

test('additionalAnswers でユーザーが追加入力した場合', () => {
  const result = normalizeConditions(
    { owner: null, timeHorizon: null, decisionRule: null },
    { owner: true, timeHorizon: true, decisionRule: true },
    { owner: '取締役会', timeHorizon: '来月末' }
  );
  assert.deepEqual(result, {
    owner: '取締役会',
    timeHorizon: '来月末',
    decisionRule: null, // 未回答は null のまま
  });
});

test('受け入れ基準ケース: owner=null, timeHorizon="次回ボード", decisionRule=null', () => {
  const result = normalizeConditions(
    { owner: null, timeHorizon: '次回ボード', decisionRule: null },
    { owner: true, timeHorizon: false, decisionRule: true },
    {}
  );
  assert.deepEqual(result, { owner: null, timeHorizon: '次回ボード', decisionRule: null });
});

// ── toDisplayValue ─────────────────────────────────────────────────────────────

console.log('\ntoDisplayValue');

test('null → "未確定"', () => {
  assert.equal(toDisplayValue(null), '未確定');
});

test('文字列 → そのまま返す', () => {
  assert.equal(toDisplayValue('CEO'), 'CEO');
});

test('"取締役会" → そのまま返す（ユーザーが入力した値）', () => {
  assert.equal(toDisplayValue('取締役会'), '取締役会');
});

// ── buildUnresolvedPoints ──────────────────────────────────────────────────────

console.log('\nbuildUnresolvedPoints');

test('全て null → 3項目全て列挙', () => {
  const result = buildUnresolvedPoints({ owner: null, timeHorizon: null, decisionRule: null });
  assert.deepEqual(result, ['最終責任者', '判断期限', '判断基準']);
});

test('owner と decisionRule が null → 2項目', () => {
  const result = buildUnresolvedPoints({
    owner: null,
    timeHorizon: '次回ボード',
    decisionRule: null,
  });
  assert.deepEqual(result, ['最終責任者', '判断基準']);
});

test('全て確定 → 空配列', () => {
  const result = buildUnresolvedPoints({
    owner: 'CEO',
    timeHorizon: '今月末',
    decisionRule: 'ROI',
  });
  assert.deepEqual(result, []);
});

test('表示順序: 最終責任者 → 判断期限 → 判断基準', () => {
  const result = buildUnresolvedPoints({ owner: null, timeHorizon: null, decisionRule: null });
  assert.equal(result[0], '最終責任者');
  assert.equal(result[1], '判断期限');
  assert.equal(result[2], '判断基準');
});

// ── buildRawPayload ────────────────────────────────────────────────────────────

console.log('\nbuildRawPayload');

test('受け入れ基準: raw payload の構造', () => {
  const conditions = { owner: null, timeHorizon: '次回ボード', decisionRule: null };
  const result = buildRawPayload(conditions);
  assert.deepEqual(result, {
    conditions: { owner: null, timeHorizon: '次回ボード', decisionRule: null },
    unresolvedPoints: ['最終責任者', '判断基準'],
  });
});

test('null が "未確定" 文字列に変換されていない', () => {
  const conditions = { owner: null, timeHorizon: null, decisionRule: null };
  const result = buildRawPayload(conditions);
  assert.equal(result.conditions.owner, null);
  assert.equal(result.conditions.decisionRule, null);
  assert.notEqual(result.conditions.owner, '未確定');
});

// ── assertConditionInvariants ─────────────────────────────────────────────────

console.log('\nassertConditionInvariants');

test('正常系: null と "未確定" が対応していれば throw しない', () => {
  assert.doesNotThrow(() =>
    assertConditionInvariants(
      { owner: null, timeHorizon: '今月末', decisionRule: null },
      '未確定',
      '今月末',
      '未確定',
      ['最終責任者', '判断基準']
    )
  );
});

test('owner=null なのに "取締役会" を表示 → invariant violation', () => {
  assert.throws(
    () =>
      assertConditionInvariants(
        { owner: null, timeHorizon: '今月末', decisionRule: null },
        '取締役会', // ← 不正
        '今月末',
        '未確定',
        ['最終責任者', '判断基準']
      ),
    /invariant violation/
  );
});

test('decisionRule=null なのに "事業整合" を表示 → invariant violation', () => {
  assert.throws(
    () =>
      assertConditionInvariants(
        { owner: null, timeHorizon: '今月末', decisionRule: null },
        '未確定',
        '今月末',
        '事業整合', // ← 不正
        ['最終責任者', '判断基準']
      ),
    /invariant violation/
  );
});

test('全て確定: unresolvedPoints 空 → throw しない', () => {
  assert.doesNotThrow(() =>
    assertConditionInvariants(
      { owner: 'CEO', timeHorizon: '今月末', decisionRule: 'ROI' },
      'CEO',
      '今月末',
      'ROI',
      []
    )
  );
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n結果: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
