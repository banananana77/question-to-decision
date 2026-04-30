/**
 * resolveEffectiveType の単体テスト
 *
 * 実行方法:
 *   npx tsx src/lib/q2d/__tests__/effectiveType.test.ts
 */

import assert from 'node:assert/strict';
import { resolveEffectiveType } from '../effectiveType';
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

// ── selectedType が other 以外 ─────────────────────────────────────────────────

console.log('\n[1] selectedType が other 以外');

test('continuation → continuation を返す', () => {
  const result = resolveEffectiveType({ selectedType: 'continuation', reclassificationResult: null });
  assert.equal(result, 'continuation');
});

test('roi_interpretation → roi_interpretation を返す', () => {
  const result = resolveEffectiveType({ selectedType: 'roi_interpretation', reclassificationResult: null });
  assert.equal(result, 'roi_interpretation');
});

test('responsibility_structure → responsibility_structure を返す', () => {
  const result = resolveEffectiveType({ selectedType: 'responsibility_structure', reclassificationResult: null });
  assert.equal(result, 'responsibility_structure');
});

test('selectedType null → other にフォールバック', () => {
  const result = resolveEffectiveType({ selectedType: null, reclassificationResult: null });
  assert.equal(result, 'other');
});

// ── selectedType === 'other' + reclassificationResult なし ────────────────────

console.log('\n[2] selectedType === other + reclassificationResult なし');

test('reclassificationResult null → other を返す', () => {
  const result = resolveEffectiveType({ selectedType: 'other', reclassificationResult: null });
  assert.equal(result, 'other');
});

test('reclassificationResult undefined → other を返す', () => {
  const result = resolveEffectiveType({ selectedType: 'other', reclassificationResult: undefined });
  assert.equal(result, 'other');
});

// ── selectedType === 'other' + 低信頼 ────────────────────────────────────────

console.log('\n[3] selectedType === other + confidence < 0.7');

test('confidence 0.69 → other を返す', () => {
  const rc: ReclassificationResult = {
    suggestedType: 'responsibility_structure',
    confidence: 0.69,
    reasoning: 'low confidence',
  };
  const result = resolveEffectiveType({ selectedType: 'other', reclassificationResult: rc });
  assert.equal(result, 'other');
});

test('confidence 0.0 → other を返す', () => {
  const rc: ReclassificationResult = {
    suggestedType: 'continuation',
    confidence: 0.0,
    reasoning: 'no signal',
  };
  const result = resolveEffectiveType({ selectedType: 'other', reclassificationResult: rc });
  assert.equal(result, 'other');
});

// ── selectedType === 'other' + truly_other ────────────────────────────────────

console.log('\n[4] selectedType === other + suggestedType === truly_other');

test('confidence >= 0.7 でも truly_other なら other を返す', () => {
  const rc: ReclassificationResult = {
    suggestedType: 'truly_other',
    confidence: 0.9,
    reasoning: 'genuinely other',
  };
  const result = resolveEffectiveType({ selectedType: 'other', reclassificationResult: rc });
  assert.equal(result, 'other');
});

// ── selectedType === 'other' + 高信頼 + 有効 suggestedType ───────────────────

console.log('\n[5] selectedType === other + 高信頼 + 有効な suggestedType');

test('confidence 0.7 + responsibility_structure → responsibility_structure を返す', () => {
  const rc: ReclassificationResult = {
    suggestedType: 'responsibility_structure',
    confidence: 0.7,
    reasoning: 'clear responsibility issue',
  };
  const result = resolveEffectiveType({ selectedType: 'other', reclassificationResult: rc });
  assert.equal(result, 'responsibility_structure');
});

test('confidence 0.9 + continuation → continuation を返す', () => {
  const rc: ReclassificationResult = {
    suggestedType: 'continuation',
    confidence: 0.9,
    reasoning: 'continuation pattern',
  };
  const result = resolveEffectiveType({ selectedType: 'other', reclassificationResult: rc });
  assert.equal(result, 'continuation');
});

test('confidence 0.85 + roi_interpretation → roi_interpretation を返す', () => {
  const rc: ReclassificationResult = {
    suggestedType: 'roi_interpretation',
    confidence: 0.85,
    reasoning: 'roi ambiguity',
  };
  const result = resolveEffectiveType({ selectedType: 'other', reclassificationResult: rc });
  assert.equal(result, 'roi_interpretation');
});

test('confidence 1.0 + responsibility_structure → responsibility_structure を返す', () => {
  const rc: ReclassificationResult = {
    suggestedType: 'responsibility_structure',
    confidence: 1.0,
    reasoning: 'maximum confidence',
  };
  const result = resolveEffectiveType({ selectedType: 'other', reclassificationResult: rc });
  assert.equal(result, 'responsibility_structure');
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
