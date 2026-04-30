import { detectMix } from '@/lib/q2d/layer1-detect-mix';
import { separateIssues } from '@/lib/q2d/layer2-separate-issues';
import { convertProblemTask, extractNotAskableReasons } from '@/lib/q2d/layer3-problem-task';
import { logger, safeErrorMeta } from '@/lib/logging/logger';
import { DEMO_LIMITS } from '@/config/limits';
import type { Q2DResult, Layer2Output } from '@/schemas/output.schema';

/**
 * Q2Dパイプライン実行（Layer 1〜3統合）
 */
export async function runQ2DPipeline(inputText: string): Promise<Q2DResult> {
  try {
    logger.info('Q2D Pipeline: Starting', {
      inputLength: inputText.length,
    });

    // Layer 1: 混線検知
    const layer1Result = await detectMix(inputText);

    // Layer 2: 論点分離
    const layer2Result = await separateIssues(inputText);

    // Layer 1-2 整合性チェック（Layer 2 を基本的に信頼）
    let finalLayer2Result: Layer2Output = layer2Result;

    if (!layer1Result.isMixed && layer2Result.issues.length > 1) {
      logger.warn('Layer 1-2 inconsistency: Layer1=not mixed but Layer2 returned multiple issues', {
        layer1IssueCount: layer1Result.issueCount,
        layer2IssueCount: layer2Result.issues.length,
      });

      if (layer2Result.issues.length <= layer1Result.issueCount * 2) {
        // Layer 1 推定値の2倍以内なら Layer 2 を信頼
        logger.info('Trusting Layer 2 output (within 2x of Layer 1 estimate)');
      } else {
        // 極端な乖離の場合のみ上限を適用
        logger.warn('Large discrepancy detected, applying limit');
        const limit = Math.min(layer1Result.issueCount * 2, DEMO_LIMITS.MAX_ISSUES);
        const trimmedIssues = layer2Result.issues.slice(0, limit);
        const validIds = new Set(trimmedIssues.map((i) => i.id));
        finalLayer2Result = {
          issues: trimmedIssues,
          dependencies: layer2Result.dependencies.filter(
            (dep) => validIds.has(dep.from) && validIds.has(dep.to)
          ),
        };
      }
    } else if (layer1Result.isMixed && layer2Result.issues.length === 1) {
      // Layer 1 が「混在あり」だが Layer 2 が1論点 → Layer 2 を信頼（Layer 1 の誤検知）
      logger.warn('Layer 1-2 inconsistency: Layer1=mixed but Layer2 returned single issue — trusting Layer 2');
    }

    // Layer 3: 問題/課題切り分け
    const layer3Result = await convertProblemTask(finalLayer2Result);

    // 「問えない理由」と判断条件の検出値を抽出
    const { reasons: notAskableReasons, extractedConditions } =
      await extractNotAskableReasons(inputText, layer3Result);

    const result: Q2DResult = {
      layer1: layer1Result,
      layer2: finalLayer2Result,
      layer3: layer3Result,
      notAskableReasons,
      extractedConditions,
    };

    logger.info('Q2D Pipeline: Completed', {
      isMixed: layer1Result.isMixed,
      estimatedIssues: layer1Result.issueCount,
      actualIssues: finalLayer2Result.issues.length,
      taskCount: layer3Result.tasks.length,
      reasonCount: notAskableReasons.length,
    });

    return result;
  } catch (error) {
    logger.error('Q2D Pipeline: Failed', { stage: 'pipeline', ...safeErrorMeta(error) });
    throw new Error('Q2D Pipeline execution failed');
  }
}
