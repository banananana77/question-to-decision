/**
 * promptMode 回帰確認スクリプト
 * 実行: npx tsx src/lib/q2d/__tests__/check-promptmode.ts
 */
import { generateDCPrompt } from '../dc-prompt';

const base = {
  q1: 'AI本格導入範囲が未定',
  q2: '導入判断の基準を固めたい',
  layer3: {
    problems: [{ id: 'p1', description: 'AI本格導入の判断基準が未定', issueId: 'i1' }],
    tasks: [{ id: 't1', description: '導入判断基準の策定', problemId: 'p1', issueId: 'i1' }],
    conversions: [{ problemId: 'p1', taskId: 't1', reasoning: '問題を課題化' }],
  },
  extractedConditions: { owner: null, timeHorizon: '次回経営会議まで', decisionRule: null },
  additionalQuestionsNeeded: { owner: true, timeHorizon: false, decisionRule: true },
  additionalAnswers: { owner: '未確定' },
  hasDependencies: false,
  frontContext: {
    selectedType: 'pre_adoption' as const,
    effectiveType: 'pre_adoption' as const,
    mandatoryConditions: { owner: '未確定', timeHorizon: '次回経営会議まで', budgetSource: 'AI導入検討予算' },
  },
};

const MARKER = '以下の入力をもとに';
// pre_adoption で出てはいけない「定義ブロック」のヘッダー
const CONT_STOP_BLOCK = '【Continue / Stop Definition:';
const SCALE_DOWN_BLOCK = '【Scale-Down Definition:';

let passed = 0;
let failed = 0;

function check(label: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

// ── A. intermediate ──────────────────────────────────────────────────────────
console.log('\n[A] intermediate (selectedQ2Id=pre_basis, promptMode=intermediate)');
const promptI = generateDCPrompt({ ...base, promptMode: 'intermediate' });
const goalLineI = promptI.split('\n').find(l => l.includes('実現したい成果:')) ?? '';

check('実現したい成果が q2 のまま', goalLineI.includes('導入判断の基準を固めたい'), goalLineI);
check('「導入判断基準を策定」が含まれる', promptI.includes('導入判断基準を策定'));
check('Continue/Stop Definition ブロックが出ない', !promptI.includes(CONT_STOP_BLOCK) && !promptI.includes(SCALE_DOWN_BLOCK));
check('owner未確定が残る', promptI.includes('ownerが未確定') || promptI.includes('最終判断者が未確定'));
check('markerCount = 1', (promptI.match(new RegExp(MARKER, 'g')) || []).length === 1);
check('typeHint が intermediate 文言', promptI.includes('継続・停止より始めるか否かの判断が主軸'));

// ── B. final ─────────────────────────────────────────────────────────────────
console.log('\n[B] final (selectedQ2Id=pre_basis, promptMode=final)');
const promptF = generateDCPrompt({ ...base, promptMode: 'final' });
const goalLineF = promptF.split('\n').find(l => l.includes('実現したい成果:')) ?? '';

check('実現したい成果が final 文言', goalLineF.includes('導入可否・導入範囲を比較判断する'), goalLineF);
check('「導入判断の基準を固めたい」が出ない', !promptF.includes('導入判断の基準を固めたい'));
check('「導入判断基準を策定」が出ない', !promptF.includes('導入判断基準を策定'));
check('Continue/Stop Definition ブロックが出ない', !promptF.includes(CONT_STOP_BLOCK) && !promptF.includes(SCALE_DOWN_BLOCK));
check('owner未確定が残る', promptF.includes('ownerが未確定') || promptF.includes('最終判断者が未確定'));
check('markerCount = 1', (promptF.match(new RegExp(MARKER, 'g')) || []).length === 1);
check('typeHint が final 文言', promptF.includes('本格導入 / 限定導入 / 延期 / 見送りの比較判断が主軸'));

// ── C. promptMode なし（既存ケースの回帰） ─────────────────────────────────
console.log('\n[C] promptMode なし (既存動作維持)');
const promptN = generateDCPrompt(base);
const goalLineN = promptN.split('\n').find(l => l.includes('実現したい成果:')) ?? '';

check('実現したい成果が q2 のまま', goalLineN.includes('導入判断の基準を固めたい'), goalLineN);
check('Continue/Stop Definition ブロックが出ない', !promptN.includes(CONT_STOP_BLOCK) && !promptN.includes(SCALE_DOWN_BLOCK));
check('markerCount = 1', (promptN.match(new RegExp(MARKER, 'g')) || []).length === 1);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
