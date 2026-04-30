import { z } from 'zod';

const issueSchema = z.object({
  id: z.string(),
  text: z.string(),
  sourceInput: z.string(),
  separatedFrom: z.array(z.string()).optional(),
});

const problemSchema = z.object({
  id: z.string(),
  description: z.string(),
  issueId: z.string(),
});

const taskSchema = z.object({
  id: z.string(),
  description: z.string(),
  problemId: z.string(),
  issueId: z.string(),
});

const notAskableReasonSchema = z.object({
  category: z.enum(['owner_unclear', 'time_horizon_missing', 'decision_rule_ambiguous', 'mixed_issues']),
  description: z.string(),
  evidence: z.string().optional(),
});

export const layer1OutputSchema = z.object({
  isMixed: z.boolean(),
  reasoning: z.string().max(200),
  issueCount: z.number().int().min(1).max(10),
});

export const layer2OutputSchema = z.object({
  issues: z.array(issueSchema),
  dependencies: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      type: z.enum(['prerequisite', 'related']),
    })
  ),
});

export const layer3OutputSchema = z.object({
  problems: z.array(problemSchema),
  tasks: z.array(taskSchema),
  conversions: z.array(
    z.object({
      problemId: z.string(),
      taskId: z.string(),
      reasoning: z.string(),
    })
  ),
});

// 判断条件の抽出値（LLMが入力から直接検出した値）
export const extractedConditionsSchema = z.object({
  owner: z.string().nullable(),       // 検出できた場合の値 / null = 不明確
  timeHorizon: z.string().nullable(), // 検出できた場合の値 / null = 不明確
  decisionRule: z.string().nullable(),// 検出できた場合の値 / null = 不明確
});

export const q2dResultSchema = z.object({
  layer1: layer1OutputSchema,
  layer2: layer2OutputSchema,
  layer3: layer3OutputSchema,
  notAskableReasons: z.array(notAskableReasonSchema),
  extractedConditions: extractedConditionsSchema,
});

export type Layer1Output = z.infer<typeof layer1OutputSchema>;
export type Layer2Output = z.infer<typeof layer2OutputSchema>;
export type Layer3Output = z.infer<typeof layer3OutputSchema>;
export type ExtractedConditions = z.infer<typeof extractedConditionsSchema>;
export type Q2DResult = z.infer<typeof q2dResultSchema>;

// ── Q1 Analysis (Q2 option generation) ──────────────────────────────────────

export const q2OptionSchema = z.object({
  id: z.string(),
  text: z.string(),
});

export const q1AnalysisOutputSchema = z.object({
  options: z.array(q2OptionSchema).min(2).max(4),
});

export type Q2Option = z.infer<typeof q2OptionSchema>;
export type Q1AnalysisOutput = z.infer<typeof q1AnalysisOutputSchema>;

// ── Additional questions ─────────────────────────────────────────────────────

export const additionalAnswersSchema = z.object({
  owner: z.string().optional(),
  timeHorizon: z.string().optional(),
  decisionRule: z.string().optional(),
});

export type AdditionalAnswers = z.infer<typeof additionalAnswersSchema>;

// ── Full Q2D pipeline result (enriched for new flow) ─────────────────────────

export const additionalQuestionsNeededSchema = z.object({
  owner: z.boolean(),
  timeHorizon: z.boolean(),
  decisionRule: z.boolean(),
});

export const q2dPipelineResultSchema = z.object({
  q1: z.string(),
  q2: z.string(),
  layer1: layer1OutputSchema,
  layer2: layer2OutputSchema,
  layer3: layer3OutputSchema,
  notAskableReasons: z.array(notAskableReasonSchema),
  extractedConditions: extractedConditionsSchema,
  additionalQuestionsNeeded: additionalQuestionsNeededSchema,
  hasDependencies: z.boolean(),
});

export type AdditionalQuestionsNeeded = z.infer<typeof additionalQuestionsNeededSchema>;
export type Q2DPipelineResult = z.infer<typeof q2dPipelineResultSchema>;
