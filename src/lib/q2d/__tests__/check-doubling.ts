/**
 * プロンプト二重出力の調査スクリプト
 * 実行: npx tsx src/lib/q2d/__tests__/check-doubling.ts
 */
import { generateDCPrompt } from '../dc-prompt';

const prompt = generateDCPrompt({
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
    selectedType: 'pre_adoption',
    effectiveType: 'pre_adoption',
    mandatoryConditions: { owner: '未確定', timeHorizon: '次回経営会議まで', budgetSource: 'AI導入検討予算' },
  },
});

const MARKER = '以下の入力をもとに';
const count = (prompt.match(new RegExp(MARKER, 'g')) || []).length;

console.log(`\n=== 「${MARKER}」の出現回数: ${count} ===`);
console.log(`=== 全長: ${prompt.length} 文字 ===\n`);

if (count > 1) {
  console.log('⚠️  二重出力が検出されました');
  // どこで2回目が始まるか特定
  const firstIdx = prompt.indexOf(MARKER);
  const secondIdx = prompt.indexOf(MARKER, firstIdx + 1);
  console.log(`  1回目: ${firstIdx}文字目`);
  console.log(`  2回目: ${secondIdx}文字目`);
  console.log('\n--- 2回目の前後50文字 ---');
  console.log(prompt.slice(Math.max(0, secondIdx - 50), secondIdx + 100));
} else {
  console.log('✅ 二重出力なし（generateDCPrompt 単体では正常）');
}

console.log('\n--- 先頭400文字 ---');
console.log(prompt.slice(0, 400));
console.log('\n--- 末尾400文字 ---');
console.log(prompt.slice(-400));
