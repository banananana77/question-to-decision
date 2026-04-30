import { callClaude } from '@/lib/llm/client';
import { createLayer2Prompt } from '@/lib/llm/prompts';
import { parseLayer2Output } from '@/lib/llm/parser';
import { logger, safeErrorMeta } from '@/lib/logging/logger';
import { DEMO_LIMITS } from '@/config/limits';
import type { Layer2Output } from '@/schemas/output.schema';

/**
 * Layer 2: 論点分離
 * 混在した論点を独立単位に切り出す
 */
export async function separateIssues(inputText: string): Promise<Layer2Output> {
  try {
    logger.info('Layer2: Starting issue separation');

    const prompt = createLayer2Prompt(inputText);
    const response = await callClaude({
      prompt,
      maxTokens: 1500,
      temperature: 0.3,
    });

    const parsed = parseLayer2Output(response);

    // DEMO版制限チェック（最大3論点）
    if (parsed.issues.length > DEMO_LIMITS.MAX_ISSUES) {
      logger.warn('Layer2: Issue count exceeds DEMO limit', {
        count: parsed.issues.length,
        limit: DEMO_LIMITS.MAX_ISSUES,
      });

      const trimmedIssues = parsed.issues.slice(0, DEMO_LIMITS.MAX_ISSUES);
      const validIds = new Set(trimmedIssues.map((i) => i.id));
      const trimmedDeps = parsed.dependencies.filter(
        (dep) => validIds.has(dep.from) && validIds.has(dep.to)
      );

      const result: Layer2Output = {
        issues: trimmedIssues,
        dependencies: trimmedDeps,
      };

      logger.info('Layer2: Issue separation completed (trimmed)', {
        issueCount: result.issues.length,
        dependencyCount: result.dependencies.length,
      });

      return result;
    }

    logger.info('Layer2: Issue separation completed', {
      issueCount: parsed.issues.length,
      dependencyCount: parsed.dependencies.length,
    });

    return parsed;
  } catch (error) {
    logger.error('Layer2: Issue separation failed', { stage: 'layer2', ...safeErrorMeta(error) });
    throw new Error('Layer2 processing failed');
  }
}
