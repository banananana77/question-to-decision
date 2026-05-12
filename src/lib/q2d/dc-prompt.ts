import type {
  Layer3Output,
  AdditionalAnswers,
  AdditionalQuestionsNeeded,
  ExtractedConditions,
} from '@/schemas/output.schema';
import type { SupportedLocale } from '@/types/q2d';

// ── Types ────────────────────────────────────────────────────────────────────

type ConditionValue = string | null;

export interface NormalizedConditions {
  owner: ConditionValue;
  timeHorizon: ConditionValue;
  decisionRule: ConditionValue;
}

export interface DCRawPayload {
  conditions: NormalizedConditions;
  unresolvedPoints: string[];
}

export type InvestmentTypeIdForDC =
  | 'continuation'
  | 'roi_interpretation'
  | 'expansion'
  | 'responsibility_structure'
  | 'pre_adoption'
  | 'other';

export interface FrontContext {
  selectedType: InvestmentTypeIdForDC | null;
  effectiveType: InvestmentTypeIdForDC;
  mandatoryConditions: {
    owner: string;
    timeHorizon: string;
    budgetSource: string;
  };
}

export interface DCPromptParams {
  q1: string;
  q2: string;
  layer3: Layer3Output;
  extractedConditions: ExtractedConditions;
  additionalQuestionsNeeded: AdditionalQuestionsNeeded;
  additionalAnswers: AdditionalAnswers;
  hasDependencies: boolean;
  frontContext?: FrontContext;
  promptMode?: 'intermediate' | 'final';
  locale?: SupportedLocale;
  selectedQ2Id?: string;
}

// ── Core functions (pure, exported for testing) ───────────────────────────────

/**
 * 最終的な条件値を解決する（string | null を維持）
 *
 * 優先順位:
 * 1. needed=false（入力から検出済み）→ extractedConditions の値（null の場合も維持）
 * 2. needed=true かつ userAnswer あり → ユーザー入力値
 * 3. needed=true かつ userAnswer なし → null（未確定）
 *
 * ★ 推論補完・デフォルト値の設定は一切行わない
 */
export function resolveToNullable(
  needed: boolean,
  extracted: string | null,
  userAnswer: string | undefined
): ConditionValue {
  if (!needed) return extracted;
  return userAnswer || null;
}

/**
 * extractedConditions + additionalAnswers から正規化済み条件を生成する
 * これが single source of truth となる
 */
export function normalizeConditions(
  extractedConditions: ExtractedConditions,
  additionalQuestionsNeeded: AdditionalQuestionsNeeded,
  additionalAnswers: AdditionalAnswers
): NormalizedConditions {
  return {
    owner: resolveToNullable(
      additionalQuestionsNeeded.owner,
      extractedConditions.owner,
      additionalAnswers.owner
    ),
    timeHorizon: resolveToNullable(
      additionalQuestionsNeeded.timeHorizon,
      extractedConditions.timeHorizon,
      additionalAnswers.timeHorizon
    ),
    decisionRule: resolveToNullable(
      additionalQuestionsNeeded.decisionRule,
      extractedConditions.decisionRule,
      additionalAnswers.decisionRule
    ),
  };
}

/**
 * null → "未確定" に変換する（UI表示用のみ）
 * ★ downstream payload では使用しない
 */
export function toDisplayValue(value: ConditionValue): string {
  return value ?? '未確定';
}

/**
 * null 条件から未確定点リストを機械的に生成する
 * 表示順序: 最終責任者 → 判断期限 → 判断基準
 */
export function buildUnresolvedPoints(conditions: NormalizedConditions): string[] {
  const points: string[] = [];
  if (conditions.owner === null) points.push('最終責任者');
  if (conditions.timeHorizon === null) points.push('判断期限');
  if (conditions.decisionRule === null) points.push('判断基準');
  return points;
}

/**
 * "未確定" / "未定" / "不明" などの名目値を「未設定」と判定する
 * truthy だが意味的に未確定な文字列を確定済み値として扱わないための共通判定
 */
export function isUnsetCondition(value?: string | null): boolean {
  if (!value) return true;
  return ['未確定', '未定', '不明'].includes(value.trim());
}

/**
 * mandatoryConditions の未設定値を unresolvedPoints に補完する
 * LLM 抽出が null でも mandatoryConditions でカバーされている場合は追加しない
 */
export function normalizeUnresolvedPoints(
  mandatoryConditions: { owner: string; timeHorizon: string; budgetSource: string } | undefined,
  unresolvedPoints: string[] = []
): string[] {
  if (!mandatoryConditions) return unresolvedPoints;
  const normalized = [...unresolvedPoints];
  const addIfMissing = (text: string, keywords: string[]) => {
    const exists = normalized.some((p) => keywords.some((k) => p.includes(k)));
    if (!exists) normalized.push(text);
  };
  if (isUnsetCondition(mandatoryConditions.owner)) addIfMissing('最終判断者が未確定', ['判断者', '責任者', 'owner']);
  if (isUnsetCondition(mandatoryConditions.timeHorizon)) addIfMissing('判断期限が未確定', ['期限', 'timeHorizon']);
  if (isUnsetCondition(mandatoryConditions.budgetSource)) addIfMissing('予算・投資枠が未確定', ['予算', '投資', 'budget']);
  return normalized;
}

/**
 * raw payload（Decision Compression への構造化入力）を生成する
 * display string ではなく null を維持する
 */
export function buildRawPayload(conditions: NormalizedConditions): DCRawPayload {
  return {
    conditions,
    unresolvedPoints: buildUnresolvedPoints(conditions),
  };
}

// ── Invariant checks ─────────────────────────────────────────────────────────

/**
 * 表示値と raw 値の整合性を検証する
 * null なのに "未確定" 以外の表示が出ていたら不正
 */
export function assertConditionInvariants(
  conditions: NormalizedConditions,
  displayOwner: string,
  displayTimeHorizon: string,
  displayDecisionRule: string,
  unresolvedPoints: string[]
): void {
  if (conditions.owner === null && displayOwner !== '未確定') {
    throw new Error(
      `[invariant violation] owner is null but displayOwner is "${displayOwner}" — fallback補完が発生しています`
    );
  }
  if (conditions.timeHorizon === null && displayTimeHorizon !== '未確定') {
    throw new Error(
      `[invariant violation] timeHorizon is null but displayTimeHorizon is "${displayTimeHorizon}" — fallback補完が発生しています`
    );
  }
  if (conditions.decisionRule === null && displayDecisionRule !== '未確定') {
    throw new Error(
      `[invariant violation] decisionRule is null but displayDecisionRule is "${displayDecisionRule}" — fallback補完が発生しています`
    );
  }
  if (unresolvedPoints.length > 0) {
    const hasNoneText =
      displayOwner === 'なし' ||
      displayTimeHorizon === 'なし' ||
      displayDecisionRule === 'なし';
    if (hasNoneText) {
      throw new Error(
        `[invariant violation] unresolvedPoints が存在するのに "なし" が表示されています`
      );
    }
  }
}

// ── DC prompt generation ──────────────────────────────────────────────────────

/**
 * Decision Compression に渡す実行プロンプトを生成する（3セクション構造）
 * LLM不要・純粋なテンプレート処理
 */
export function generateDCPrompt(params: DCPromptParams): string {
  if ((params.locale ?? 'ja') === 'en') {
    return generateDCPromptEn(params);
  }
  const {
    q1,
    q2,
    layer3,
    extractedConditions,
    additionalQuestionsNeeded,
    additionalAnswers,
    hasDependencies,
    frontContext,
    promptMode,
  } = params;
  const isPreAdoptionFinal = frontContext?.effectiveType === 'pre_adoption' && promptMode === 'final';

  // Step 1: 正規化（single source of truth）
  const conditions = normalizeConditions(
    extractedConditions,
    additionalQuestionsNeeded,
    additionalAnswers
  );

  // Step 2: 表示値（UI表示専用。downstream には使用しない）
  const displayOwner = toDisplayValue(conditions.owner);
  const displayTimeHorizon = toDisplayValue(conditions.timeHorizon);
  const displayDecisionRule = toDisplayValue(conditions.decisionRule);

  // Step 3: 未確定点（null から機械的に生成 → mandatoryConditions で補完）
  const unresolvedPoints = normalizeUnresolvedPoints(
    frontContext?.mandatoryConditions,
    buildUnresolvedPoints(conditions)
  );
  const unresolvedText =
    unresolvedPoints.length > 0
      ? unresolvedPoints.map((p) => `- ${p}`).join('\n')
      : 'なし';

  // Step 4: invariant check
  assertConditionInvariants(
    conditions,
    displayOwner,
    displayTimeHorizon,
    displayDecisionRule,
    unresolvedPoints
  );

  // Step 5: raw payload（null を維持した構造化データ）
  const rawPayload: DCRawPayload = { conditions, unresolvedPoints };

  // 問題リスト（最大4件）
  const problemsText = layer3.problems
    .slice(0, 4)
    .map((p, i) => `${i + 1}. ${p.description}`)
    .join('\n');

  // 課題リスト
  const tasksText = layer3.tasks
    .map((t, i) => `${i + 1}. ${t.description}`)
    .join('\n');

  const issueCount = layer3.problems.length;

  // Step 6: フロントで固定した構造情報ブロック（optional）
  const frontContextBlock = frontContext
    ? `【Front Context: フロントで固定した構造情報】
\`\`\`json
${JSON.stringify(frontContext, null, 2)}
\`\`\`

`
    : '';

  // Step 7: 前段ガイダンス（frontContext がある場合のみ）
  const typeHintMap: Record<InvestmentTypeIdForDC, string> = {
    continuation: '継続 / 縮小 / 停止の判断として優先的に読む',
    roi_interpretation: 'ROI未達の解釈と比較基準の問題として優先的に読む',
    expansion: '拡大 / 追加投資 / 全社展開の判断として優先的に読む（boundary相当）',
    responsibility_structure: '責任者 / 停止権限 / owner不在の問題として優先的に読む',
    pre_adoption: isPreAdoptionFinal
      ? 'Pre-Adoption（導入判断比較）として優先的に読む。本格導入 / 限定導入 / 延期 / 見送りの比較判断が主軸'
      : '導入判断（Pre段階）として優先的に読む。継続・停止より始めるか否かの判断が主軸',
    other: '今止まっている判断を1つに絞る問題として優先的に読む',
  } as const;

  const frontGuidanceBlock = frontContext
    ? `【Interpretation Guidance: フロントで固定した構造情報の扱い】
- effectiveType（${frontContext.effectiveType}）は今回の主要な判断型として優先的に参照してください
- 読み方ヒント: ${typeHintMap[frontContext.effectiveType]}
- owner / timeHorizon / budgetSource は今回の判断前提です（空の場合は未確定として扱う）
- ただし本文と矛盾する場合は、frontContext を絶対視せず、本文の記述も観測してください
- 出力では、frontContext に引っ張られすぎず、本文との整合を保ってください

【Decision Rule: 判断基準の扱い方】
- 「改善可能性が高い」「有望である」のような形容詞で判断軸を終わらせないこと
- 各判断面の選択肢には、「どんな事実・条件が観測されればその選択肢を採るか」を付けること
- 数値KPIがなくても、Yes/Noで観測できる条件、または期限付きの確認条件（例:「次回役員会までに○○が確認できれば」）として書くこと
- 判断基準が未確定（null）の場合でも、「この論点を判断するためには何を確認する必要があるか」を出力すること

${frontContext.effectiveType !== 'pre_adoption' ? `【Continue / Stop Definition: 継続と停止の採用条件】
- 「継続」を出す場合は、「改善可能性があるから継続」のような形容詞で終わらせないこと
- 「継続」は、どんな事実・条件が期限までに確認されれば採用するかを書くこと
- 継続の採用条件として可能な範囲で以下を含めること:
  - 追加投資の内容が具体化されているか（何に・いくら・いつまで）
  - 改善根拠（ベンダー計画 / 実行可能な施策 / 必要な体制）が確認できるか
  - その追加投資を正当化するだけの合理性があるか（他施策と比較して）
- 「停止」を出す場合は、「成果が出ていないから停止」のような後方起因で終わらせないこと
- 「停止」は、どの条件が確認できない場合に採用するか、またはどの否定的事実が確認された場合に採用するかを書くこと
- 停止の採用条件として可能な範囲で以下を含めること:
  - 改善根拠が確認できない（期限内に計画・体制が揃わない）
  - 追加投資の合理性が確認できない（費用対効果が他施策に劣る）
  - 他施策への再配分合理性が明確に高い
  - 継続しても主要目的に届かないことが確認される
- 継続 / 縮小 / 停止が並置されたとき、3択が同じ粒度で比較可能になるように書くこと

【Scale-Down Definition: 「縮小」の定義】
- 「縮小」を出す場合は、保留 / 様子見 / 現状維持 / 中間案として書かないこと
- 「縮小」は必ず「何を止めて、何を残すか」を含む独立した運用状態として書くこと
- 可能な範囲で以下の観点を含めること:
  - 追加投資は止めるのか（新規開発・追加費用の停止）
  - 現行運用は維持するのか（現在稼働している機能・範囲を継続するか）
  - 一部機能・一部対象範囲だけを残すのか（対象部門・ユースケースの限定）
  - FAQ / ログ / データ / 運用知見などの既存資産を他施策へ転用する前提か
- 「縮小」は継続でも停止でもない第三の運用形態であり、継続 / 縮小 / 停止が並置されたとき、縮小だけが曖昧にならないよう比較可能な状態で書くこと

` : ''}【Review Condition Template: 再判断条件のテンプレ】
- 今回決めきれない場合でも、再判断条件は必ず以下の3点を含めること:
  1. 何が揃えば再判断できるか（観測可能な条件・期限付きの確認事項）
  2. いつ再判断するか（具体的な期限またはマイルストーン）
  3. 誰が再判断をトリガーするか（判断主体 / 情報収集主体が異なる場合は両方書く）
- 「状況が改善したら」「追加情報があれば」のような抽象語で終わらせないこと
- できるだけ、期限付き・Yes/Noで観測できる条件として書くこと${!isUnsetCondition(frontContext.mandatoryConditions.owner) ? `
- owner（${frontContext.mandatoryConditions.owner}）が確定しているため、原則として ${frontContext.mandatoryConditions.owner} を再判断主体とする
- ただし情報収集主体が異なる場合は「情報収集: ○○ → 再判断: ${frontContext.mandatoryConditions.owner}」のように分けてよい` : `
- ownerが未確定の場合は、誰が再判断をトリガーするかを論点に含めること`}

【Capital Allocation: 資本配分の扱い方】${frontContext.effectiveType === 'responsibility_structure' ? `
- このケースでは投資合理性・予算再配分は主論点ではなく、責任構造が固定された後に扱うべき従属論点として位置付けること${frontContext.mandatoryConditions.budgetSource ? `
- budgetSource（${frontContext.mandatoryConditions.budgetSource}）は背景条件として参照してよいが、比較面の前面に出しすぎないこと` : ''}
- 予算配分を言及する場合は「どの責任構造が整えばその配分判断を実行できるか」という接続で書くこと
- 「撤退コスト vs. 継続コスト vs. 機会損失」の一般フレームは、責任構造の論点が整理された後の補足として扱うこと` : `${!isUnsetCondition(frontContext.mandatoryConditions.budgetSource) ? `
- budgetSource（${frontContext.mandatoryConditions.budgetSource}）はこの案件の予算枠である
- この予算を本案件に残すか、他の施策へ再配分するかという資本配分の観点を比較面に含めること
- 「撤退コスト vs. 継続コスト vs. 機会損失」の軸で選択肢を整理すること` : `
- budgetSourceは未確定だが、可能な範囲で「この案件に予算を残すか / 他へ再配分するか」という資本配分の観点を比較面に添えること`}
- サンクコスト（過去の投資）は「もったいない」という感情論ではなく、以下の経営判断言語で扱うこと:
  - 過去投資を今後の継続判断に含めるか、切り離すかの選択
  - 既存資産（データ / インフラ / 知見）を再利用できるかの観測
  - 撤退時に回収できるもの・できないものの整理`}

【Owner: 判断主体の扱い方】${!isUnsetCondition(frontContext.mandatoryConditions.owner) ? `
- owner（${frontContext.mandatoryConditions.owner}）は今回の最終判断主体である
- 可能な範囲で「何の責任範囲でこの判断を持つのか」を軽く添えること（例:「事業継続の可否」「予算執行の承認」など）
- ただし P/L 数値責任などの重い表現は必須ではない` : `
- ownerが未確定の場合は、誰がこの判断を持つべきかを出力の論点に含めること`}

${frontContext.effectiveType === 'pre_adoption' ? `【Pre-Adoption 型の出力ルール】
この型は、AI導入前または本格導入前の判断を扱う。
${isPreAdoptionFinal ? '主軸は「導入可否・導入範囲の比較判断」である。本格導入 / 限定導入 / 延期 / 見送り の4択を比較可能な形で整理することが最優先。' : '主軸は「継続・停止」ではなく、「導入可否・導入範囲・導入基準」の固定である。'}

主要な判断面:
- 本格導入する
- 限定導入で進める
- 判断を延期する
- 今回は見送る
${isPreAdoptionFinal ? '' : '- 導入判断基準を策定する\n'}
出力時の注意:
- post_adoption 型の「継続 / 縮小 / 停止」の枠組みに引きずられないこと
- 入力に「一部AI活用は始めている」とあっても、それは本格導入前の前提情報として扱うこと（post 型の継続停止判断に変換しないこと）
- 最終的な比較面は pre_adoption の判断面（本格導入 / 限定導入 / 延期 / 見送り${isPreAdoptionFinal ? '' : ' / 基準策定'}）に収束させること
- 「延期」と「見送り」は分けて扱うこと:
  - 「延期」: 追加情報を得るために判断時期を後ろに倒す判断（今回は決めず、次回に持ち越す）
  - 「見送り」: 今回は導入しないという判断（再検討する意思があっても今回は不採用）
- 各判断面には「どんな条件が揃えばその面を採用するか」を観測可能な形で付けること
${isPreAdoptionFinal ? '- 導入判断から見る場合は、仮の判断基準を置いたうえで、本格導入 / 限定導入 / 延期 / 見送りを比較すること' : '- 判断基準を策定することが主目的のケースでは、導入可否の最終判断より先に基準整理が必要であることを明示すること'}

` : ''}${frontContext.effectiveType === 'continuation' ? `【Continuation Decision Surface: 判断面の構造化】
- このケースでは、継続 / 縮小 / 停止 の3択を同粒度の比較可能な判断面として出すことが主要な目標である
- 「整理結果」で止まらず、各選択肢を採用可能な状態まで展開すること
- 各選択肢に必ず以下の4項目を含めること:
  1. 採用条件: ${displayDecisionRule !== '未確定' ? `decisionRule（${displayDecisionRule}）をベースに、` : ''}「何が（${frontContext.mandatoryConditions.timeHorizon || '期限'}までに）確認されれば採用するか」をYes/Noで観測可能な形で書くこと
  2. 残すもの / 止めるもの: 各選択肢で何を続け、何を止めるかを明示すること
  3. 予算配分の意味: ${frontContext.mandatoryConditions.budgetSource ? `budgetSource（${frontContext.mandatoryConditions.budgetSource}）に対して、この選択肢は継続コスト / 限定維持コスト / 他施策への再配分のどれを意味するか` : '継続コスト / 限定維持コスト / 他施策への再配分 のどれを意味するかを添えること'}
  4. 主な trade-off: この選択肢を採った場合の得失を対比で書くこと
- 「縮小」は保留 / 様子見 / 中間案として書かないこと。独立した運用状態として以下が見える形にすること:
  - 何を止めるか（全社展開 / 追加投資 / 新規対象部門拡大 など）
  - 何を残すか（効果確認済み部門 / 既存運用 / 既存知見 など）
  - 既存資産（データ / 知見 / 運用実績）を他施策に転用する前提があるか
- 「継続」案の「残すもの」は全利用部門の無条件維持として書かないこと。decisionRuleに適合する範囲（効果が確認できた部門・用途）での継続として書くこと
- A（継続）とB（縮小）の違いは以下のように出し分けること:
  - A（継続）: decisionRuleの採用条件が満たされており、適合範囲の維持が判断として成立している状態
  - B（縮小）: 適合範囲は限定されており、止める範囲・圧縮運用であることが前面に出る状態
- 再判断条件は「何が / いつ / 誰が情報収集 / 誰が再判断」の4点を含めること${!isUnsetCondition(frontContext.mandatoryConditions.owner) ? `
  - 情報収集と再判断の主体を分けて書くこと（例: 情報収集: 利用部門責任者・管理部門 → 再判断: ${frontContext.mandatoryConditions.owner}）` : ''}

` : ''}${frontContext.effectiveType === 'responsibility_structure' ? `【Responsibility Structure: 責任構造の読み方】
- このケースでは、継続 / 縮小 / 停止の選択そのものより、「誰が判断し、誰が停止を宣言でき、誰が運用責任を持つか」の固定を主要論点として優先すること
- owner が与えられていても絶対視せず、本文中により適切な最終判断主体・停止権限者・運用責任部署の示唆があれば観測・補正すること
- 以下の4点を優先して抽出・整理すること:
  1. 最終判断主体（final owner）: 誰がこの案件の継続 / 停止を決定できるか
  2. 停止権限者（stop authority）: 誰が「止める」と宣言する権限を持つか（最終判断主体と一致しない場合もある）
  3. 日常運用責任者（operational owner）: 誰 / どの部署がこの案件の運用を担うか
  4. 役割分離（approval / use / oversight）: 承認する役割・利用する役割・監督する役割が分離されているか、未分離であればそれが問題の中心か
- 役割が未分離・未固定の場合は、それを「未確定の判断条件」としてではなく、「今回固定すべき判断単位の一部」として扱うこと
- 投資合理性・予算配分・ROI は今回の背景条件として扱ってよく、責任固定のほうを主要論点として前に出すこと
- 継続 / 縮小 / 停止を出す場合も、単独で並置するのではなく、以下のように責任構造と接続して書くこと:
  - 「どの責任構造（owner固定・役割分離）が揃えば継続可能か」
  - 「どの責任構造が未固定だから限定運用（縮小）に戻すのか」
  - 「どの責任不備が解消されない場合に一旦停止するのか」
- decision-ready object の中心は「何を続けるか」だけでなく、「誰が持つか」「誰が止めるか」「どこで責任を分けるか」であること

【Operational Owner: 日常運用責任の固定】
- operational owner（日常運用責任者）は補足情報ではなく、final owner / stop authority と並ぶ今回固定すべき判断単位の一部として扱うこと
- 可能な範囲で部署レベルまたは役割レベルまで明示すること（例: 情報システム部 / 法務部門 / AI運用責任者 / 利用部門長）
- 本文中に operational owner の示唆がある場合は、それを観測・引用すること
- 未固定の場合は「誰が日常運用責任を持つのか未確定」を未確定点として優先露出すること
- 再判断条件においても、operational owner の指名・合意・責任分界の完了を明示的なトリガー条件として含めること

【Responsibility Unresolved / Review: 未確定点と再判断条件の読み方】
- このタイプでは、未確定点を一般的な情報不足として扱わず、責任固定されていない役割そのものを優先的に露出すること
- 以下の4点は本文から優先観測すべき未確定点候補である:
  1. final owner が本当に確定しているか（frontContext の owner を鵜呑みにせず本文と照合すること）
  2. stop authority が明示されているか（最終判断主体と同一か別人かを含めて確認）
  3. operational owner が明示されているか（部署・役割レベルまで）
  4. approval / use / oversight の役割分離が明示されているか（未分離ならそれ自体を未確定として扱う）
- unresolvedPoints が空であっても、上記のいずれかが未固定であれば、それを未確定論点として出力してよい
- このタイプの再判断条件は、投資条件・ROI条件ではなく、「どの責任役割の未固定が何で、何が揃えば固定できるか」を中心に書くこと
- 再判断条件には以下を含めること:
  - どの役割が未固定か（stop authority / operational owner / 役割分離のいずれか）
  - 何の合意・指名・ルール整備が完了すれば再判断できるか
  - いつまでにその固定を行うか（具体的な期限またはマイルストーン）
  - 誰がその固定を主導し、誰が最終再判断を行うか
- NG例: 「情報が揃えば再判断」「状況を見て再判断」「関係者で協議して再判断」
- OK例: 「stop authority と operational owner の指名が完了すれば再判断する」「approval / use / oversight 分離案が確定すれば再判断する」「期限までに責任者が分界案を承認し、事務局が必要合意を回収した時点で再判断する」

` : ''}`
    : '';

  // Step 8: 今回の判断前提（非空項目のみ自然文列挙）
  const mc = frontContext?.mandatoryConditions;
  const premisesLines = mc
    ? [
        !isUnsetCondition(mc.owner) ? `- 最終判断者: ${mc.owner}（今回の最終判断主体）` : '',
        !isUnsetCondition(mc.timeHorizon) ? `- 判断期限: ${mc.timeHorizon}（参考情報ではなく判断期限として扱う）` : '',
        !isUnsetCondition(mc.budgetSource) ? `- 予算・投資枠: ${mc.budgetSource}（配分判断の制約条件として扱う）` : '',
      ].filter(Boolean)
    : [];
  const decisionPremisesBlock =
    premisesLines.length > 0
      ? `【Decision Premises: 今回の判断前提】\n${premisesLines.join('\n')}\n\n`
      : '';

  return `以下の入力をもとに、decision-ready object に圧縮してください。

${frontContextBlock}${frontGuidanceBlock}${decisionPremisesBlock}【Section 1: 判断の全体像】
- 保留中の課題: ${q1}
- 実現したい成果: ${isPreAdoptionFinal ? '導入可否・導入範囲を比較判断する' : q2}
- 論点数: ${issueCount}件${hasDependencies ? '（論点間に依存関係あり）' : ''}

【Section 2: 判断単位の要素】

■ 問題（既に起きている現象）
${problemsText}

■ 課題（今回扱う判断対象）
${tasksText}

■ 判断条件
- 最終責任者: ${displayOwner}
- 判断期限: ${displayTimeHorizon}
- 判断基準: ${displayDecisionRule}

【Section 3: Decision Compression への実行依頼】

【未確定点】
${unresolvedText}
${frontContext?.effectiveType === 'responsibility_structure' ? `
【責任構造の確認事項（raw payloadに含まれない未固定要素）】
以下は構造化データには含まれていないが、本文から観測すべき責任構造上の確認事項である。
unresolvedPoints が空であっても、これらが未固定の場合は今回固定すべき判断単位として扱うこと。
- 停止権限者（stop authority）: 誰が「止める」を宣言できるか
- 日常運用責任者（operational owner）: どの部署・役割が運用を担うか
- 役割分離の状況（approval / use / oversight）: 承認・利用・監督が分離されているか、未分離か
` : ''}
【判断条件の構造化データ（raw）】
\`\`\`json
${JSON.stringify(rawPayload, null, 2)}
\`\`\`

【問い】
- この入力から、今回固定すべき判断単位は何か
- 今回決めない方がよい論点は何か
- 比較すべき最小限の判断軸は何か
- 各選択肢の trade-off は何か
- 未確定点を残したままでも、現時点でどこまで判断可能か

【依頼】
以下の条件で圧縮してください：
- 今回決めるべき単位のみを固定すること
- 未確定点は推論で埋めず、未確定のまま明示すること（構造化データの null を参照）
- 平均的助言ではなく、比較可能な判断面を生成すること
- 各選択肢には「この条件が確認されれば採用する」という観測可能な判定条件を付けること
- trade-off を明示すること（撤退コスト vs. 継続コスト vs. 機会損失を含む）
- 今回決めないことも分離すること
- 今回決めきれない場合は、「何が揃えば再判断できるか」「いつ / 誰が再判断をトリガーするか」を必ず含めること
- サンクコストは感情論ではなく「継続判断に含めるか切り離すか」「既存資産の再利用可否」として扱うこと${frontContext?.effectiveType !== 'pre_adoption' ? `
- 継続 / 縮小 / 停止を並置する場合、「縮小」は保留・様子見ではなく、止めるものと残すものが明示された独立した運用状態として書くこと
- 継続と停止はそれぞれ採用条件が観測可能な形（「○○が確認できれば継続」「○○が確認できなければ停止」）で書くこと` : ''}
- 再判断条件は「何が揃えば / いつ / 誰が」の3点を必ず含めること

出力形式：
以下の3ブロックで、Markdown形式で出力してください。

1. 固定された判断単位
2. Decision Surface
3. 再判断条件

JSON形式・コードブロック形式では出力しないでください。`;
}

// ── English template ──────────────────────────────────────────────────────────

function generateDCPromptEn(params: DCPromptParams): string {
  const {
    q1,
    q2,
    layer3,
    extractedConditions,
    additionalQuestionsNeeded,
    additionalAnswers,
    hasDependencies,
    frontContext,
    promptMode,
    selectedQ2Id,
  } = params;

  const isPreAdoptionFinal = frontContext?.effectiveType === 'pre_adoption' && promptMode === 'final';

  const conditions = normalizeConditions(extractedConditions, additionalQuestionsNeeded, additionalAnswers);

  const displayOwner = conditions.owner ?? 'Undetermined';
  const displayTimeHorizon = conditions.timeHorizon ?? 'Undetermined';
  const displayDecisionRule = conditions.decisionRule ?? 'Undetermined';

  // English unresolved points (raw — used in rawPayload)
  const rawUnresolved: string[] = [];
  if (conditions.owner === null) rawUnresolved.push('Final decision-maker');
  if (conditions.timeHorizon === null) rawUnresolved.push('Decision deadline');
  if (conditions.decisionRule === null) rawUnresolved.push('Decision criteria');

  // Supplement from mandatoryConditions
  const mc = frontContext?.mandatoryConditions;
  const unresolvedPoints = mc ? (() => {
    const out = [...rawUnresolved];
    if (isUnsetCondition(mc.owner) && !out.some(p => p.toLowerCase().includes('decision-maker') || p.toLowerCase().includes('owner')))
      out.push('Final decision-maker undetermined');
    if (isUnsetCondition(mc.timeHorizon) && !out.some(p => p.toLowerCase().includes('deadline')))
      out.push('Decision deadline undetermined');
    if (isUnsetCondition(mc.budgetSource) && !out.some(p => p.toLowerCase().includes('budget')))
      out.push('Budget / investment scope undetermined');
    return out;
  })() : rawUnresolved;

  const unresolvedText = unresolvedPoints.length > 0
    ? unresolvedPoints.map(p => `- ${p}`).join('\n')
    : 'None';

  const rawPayload: DCRawPayload = { conditions, unresolvedPoints: rawUnresolved };

  const problemsText = layer3.problems.slice(0, 4).map((p, i) => `${i + 1}. ${p.description}`).join('\n');
  const tasksText = layer3.tasks.map((t, i) => `${i + 1}. ${t.description}`).join('\n');
  const issueCount = layer3.problems.length;

  const frontContextBlock = frontContext
    ? `【Front Context: Structure fixed on the front end】\n\`\`\`json\n${JSON.stringify(frontContext, null, 2)}\n\`\`\`\n\n`
    : '';

  const typeHintMapEn: Record<InvestmentTypeIdForDC, string> = {
    continuation: 'Read primarily as a continue / scale-down / stop decision',
    roi_interpretation: 'Read primarily as an ROI shortfall interpretation and benchmark problem',
    expansion: 'Read primarily as a scale-up / additional investment / full-scale deployment decision (boundary equivalent)',
    responsibility_structure: 'Read primarily as a decision-maker / stop authority / ownership problem',
    pre_adoption: isPreAdoptionFinal
      ? 'Read as Pre-Adoption (adoption decision comparison). Primary focus: comparing full adoption / limited adoption / deferral / halt'
      : 'Read as an adoption decision (Pre-phase). Primary axis: whether to begin, not a continuation/stop judgment',
    other: 'Read primarily as a problem of narrowing the stalled decision to one',
  } as const;

  // Expansion: hint specific to the selected Q2 option
  const expansionQ2Hint = (() => {
    if (frontContext?.effectiveType !== 'expansion') return '';
    const hintMap: Partial<Record<string, string>> = {
      opt_1: '- Expansion focus: user wants to clarify continue-or-stop criteria within the expansion decision. Emphasize what conditions define whether to expand, maintain, or stop.\n',
      opt_2: '- Expansion focus: user wants to clarify ROI and success criteria for expansion. Emphasize what measurable outcomes justify additional investment.\n',
      opt_3: '- Expansion focus: user wants to clarify the final decision-maker and accountability scope for expansion. Emphasize who holds authority and budget.\n',
      opt_4: '- Expansion focus: user wants to clarify the criteria for the additional investment or expansion decision itself. Emphasize conditions that define whether to proceed with scaling.\n',
    };
    return selectedQ2Id ? (hintMap[selectedQ2Id] ?? '') : '';
  })();

  const frontGuidanceBlock = frontContext ? `【Interpretation Guidance: How to use the structure fixed on the front end】
- effectiveType (${frontContext.effectiveType}) is the primary decision type for this session; refer to it with priority
- Reading hint: ${typeHintMapEn[frontContext.effectiveType]}
${expansionQ2Hint}- owner / timeHorizon / budgetSource are the premises for this decision (treat as undetermined if empty)
- If frontContext conflicts with the main text, do not treat frontContext as absolute — also observe the main text description
- In the output, maintain consistency with the main text rather than being overly swayed by frontContext

【Decision Rule: How to handle decision criteria】
- Do not end judgment axes with adjectives like "high improvement potential" or "promising"
- For each option in the decision surface, include: "what facts or conditions must be observed to adopt this option"
- Even without numeric KPIs, express as a Yes/No observable condition or a deadline-bound confirmation (e.g., "if X is confirmed by the next board meeting")
- Even when the decision criterion is undetermined (null), output what needs to be confirmed to judge this issue

${frontContext.effectiveType !== 'pre_adoption' ? `【Continue / Stop Definition: Adoption conditions for continuation and stop】
- When presenting "continuation," do not end with adjectives like "because there is improvement potential"
- "Continuation" means: what facts or conditions must be confirmed by the deadline for this option to be adopted
- For continuation adoption conditions, include where possible:
  - Whether additional investment scope is specified (what, how much, by when)
  - Whether improvement rationale (vendor plan / executable initiatives / required structure) is confirmed
  - Whether this additional investment is sufficiently justified compared to alternatives
- When presenting "stop," do not end with backward causation like "because results are not showing"
- "Stop" means: which conditions failing to be confirmed lead to this option, or which negative facts being confirmed lead to it
- For stop adoption conditions, include where possible:
  - Improvement rationale cannot be confirmed (plan/structure cannot be assembled within deadline)
  - Justification for additional investment cannot be confirmed (inferior cost-effectiveness vs. alternatives)
  - Rationale for reallocation to other initiatives is clearly higher
  - Continuing will not achieve the primary objective (confirmed)
- When continuation / scale-down / stop are presented together, write all three at the same level of granularity

【Scale-Down Definition: Definition of "scale-down"】
- When presenting "scale-down," do not write it as hold / wait-and-see / status quo / compromise
- "Scale-down" must always include "what to stop and what to keep" as an independent operational state
- Include the following perspectives where possible:
  - Whether additional investment is stopped (new development / additional costs)
  - Whether current operations are maintained (currently running features/scope)
  - Whether only some features/scope remain (limiting to target departments / use cases)
  - Whether existing assets (FAQ / logs / data / operational knowledge) are transferred to other initiatives
- "Scale-down" is a third operational state distinct from continuation and stop; do not let it be ambiguous when all three are presented together

` : ''}【Review Condition Template】
- Even when a decision cannot be made this time, re-judgment conditions must always include:
  1. What must be in place for re-judgment (observable conditions, deadline-bound confirmation items)
  2. When to re-judge (specific deadline or milestone)
  3. Who triggers re-judgment (if information-gathering and decision-making parties differ, specify both)
- Do not end with abstract phrases like "when conditions improve" or "if additional information becomes available"
- Express as deadline-bound, Yes/No observable conditions where possible${!isUnsetCondition(frontContext.mandatoryConditions.owner) ? `
- Since owner (${frontContext.mandatoryConditions.owner}) is confirmed, in principle set ${frontContext.mandatoryConditions.owner} as the re-judgment party
- If the information-gathering party differs, write "Information gathering: ○○ → Re-judgment: ${frontContext.mandatoryConditions.owner}"` : `
- When owner is undetermined, include who should trigger re-judgment as a point in the output`}

【Capital Allocation: How to handle capital allocation】${frontContext.effectiveType === 'responsibility_structure' ? `
- In this case, investment rationality and budget reallocation are not the primary issues; position them as subordinate to the responsibility structure fix${frontContext.mandatoryConditions.budgetSource ? `
- budgetSource (${frontContext.mandatoryConditions.budgetSource}) may be referenced as background context, but do not overemphasize it in the comparison surface` : ''}
- When mentioning budget allocation, connect it as "which responsibility structure being in place enables that allocation decision"
- The frame of "exit cost vs. continuation cost vs. opportunity loss" should be supplementary after responsibility structure issues are organized` : `${!isUnsetCondition(frontContext.mandatoryConditions.budgetSource) ? `
- budgetSource (${frontContext.mandatoryConditions.budgetSource}) is the budget scope for this case
- Include the capital allocation perspective: whether to keep this budget in the current initiative or reallocate to other initiatives
- Organize options along the axis of "exit cost vs. continuation cost vs. opportunity loss"` : `
- budgetSource is undetermined; where possible, include the capital allocation perspective of "whether to keep budget here or reallocate"`}
- Handle sunk costs not as emotional "waste" arguments, but in business judgment language:
  - Whether to include or exclude past investment from the ongoing decision
  - Whether existing assets (data / infrastructure / knowledge) can be reused
  - What can and cannot be recovered upon exit`}

【Owner: How to handle the decision-making party】${!isUnsetCondition(frontContext.mandatoryConditions.owner) ? `
- owner (${frontContext.mandatoryConditions.owner}) is the final decision-making party for this session
- Where possible, lightly note the scope of responsibility (e.g., "authority over business continuity," "approval of budget execution")
- Heavy expressions like full P&L accountability are not required` : `
- When owner is undetermined, include who should hold this decision as a point in the output`}

${frontContext.effectiveType === 'pre_adoption' ? `【Pre-Adoption Output Rules】
This type handles decisions before or at the pre-full-adoption stage.
${isPreAdoptionFinal ? 'Primary axis: "adoption decision comparison" — comparing full adoption / limited adoption / deferral / halt in comparable form is the top priority.' : 'Primary axis: not "continue/stop" but fixing the adoption criteria / adoption scope / adoption basis.'}

Primary decision surfaces:
- Full adoption
- Limited adoption
- Defer the decision
- Halt for now
${isPreAdoptionFinal ? '' : '- Define adoption decision criteria\n'}
Output notes:
- Do not be pulled into the post-adoption "continue / scale-down / stop" framework
- Even if "some AI use has started" appears in the input, treat it as pre-adoption background context
- The final comparison surfaces should converge to pre_adoption surfaces (full adoption / limited adoption / deferral / halt${isPreAdoptionFinal ? '' : ' / criteria definition'})
- Distinguish between "deferral" and "halt":
  - "Deferral": pushing the decision timing back to gather more information (carry to next session)
  - "Halt": not adopting this time (not adopting now, even if intent to reconsider exists)
- For each decision surface, include "what conditions must be in place to adopt this surface" in observable form
${isPreAdoptionFinal ? '- When approaching from the adoption decision side, place a provisional criterion and compare full adoption / limited adoption / deferral / halt' : '- When defining criteria is the primary goal, make explicit that criteria definition must precede the final adoption decision'}

` : ''}${frontContext.effectiveType === 'continuation' ? `【Continuation Decision Surface: Structuring the decision surface】
- Primary goal: present continuation / scale-down / stop as three comparable decision surfaces at the same granularity
- Do not stop at "organized results"; develop each option to an adoptable state
- Each option must include the following 4 items:
  1. Adoption condition: ${displayDecisionRule !== 'Undetermined' ? `based on decisionRule (${displayDecisionRule}), ` : ''}write what must be confirmed (by ${frontContext.mandatoryConditions.timeHorizon || 'deadline'}) in Yes/No observable form
  2. What to keep / what to stop: explicitly state what continues and what stops for each option
  3. Capital allocation meaning: ${frontContext.mandatoryConditions.budgetSource ? `for budgetSource (${frontContext.mandatoryConditions.budgetSource}), state whether this option means continuation cost / limited maintenance cost / reallocation` : 'state whether continuation cost / limited maintenance cost / reallocation'}
  4. Primary trade-off: write the gains and losses of adopting this option in contrast
- "Scale-down" must not be hold / wait-and-see / compromise; make it an independent operational state:
  - What to stop (full deployment / additional investment / new department expansion, etc.)
  - What to keep (departments with confirmed effect / existing operations / existing knowledge, etc.)
  - Whether existing assets (data / knowledge / operational record) transfer to other initiatives
- For "continuation," do not write "what to keep" as unconditional maintenance of all departments; write as continuation within the range that meets decisionRule
- Difference between A (continuation) and B (scale-down):
  - A (continuation): decisionRule adoption conditions met; maintaining the conforming range is valid
  - B (scale-down): conforming range is limited; stopping range / compressed operation is front-facing
- Re-judgment conditions must include 4 points: what / when / who gathers information / who re-judges${!isUnsetCondition(frontContext.mandatoryConditions.owner) ? `
  - Separate information-gathering and re-judgment parties (e.g., Gathering: dept. heads → Re-judgment: ${frontContext.mandatoryConditions.owner})` : ''}

` : ''}${frontContext.effectiveType === 'responsibility_structure' ? `【Responsibility Structure: How to read the responsibility structure】
- Prioritize "who decides, who can declare stop, who holds operational responsibility" over the selection itself
- Even if owner is given, do not take it as absolute — observe the main text for better candidates
- Prioritize extracting and organizing the following 4 points:
  1. Final decision-making party (final owner): who can decide to continue / stop this initiative
  2. Stop authority: who has authority to declare "stop" (may differ from final decision-maker)
  3. Operational owner: who / which department handles day-to-day operations
  4. Role separation (approval / use / oversight): are these roles separated? If not, is that the core problem?
- If roles are unseparated/unfixed, treat that as "part of the decision unit to be fixed this time"
- Investment rationality / budget / ROI may be background context; bring the responsibility structure to the front
- When presenting continue / scale-down / stop, connect them to the responsibility structure:
  - "Which responsibility structure (owner fixed / roles separated) allows continuation"
  - "Which unfixed responsibility causes reversion to limited operation (scale-down)"
  - "Which responsibility deficiency, if unresolved, leads to temporary stop"

【Operational Owner】
- Treat operational owner as part of the decision unit to fix, on par with final owner / stop authority
- Specify to department or role level where possible
- If unfixed, prioritize exposing "operational owner undetermined" as an unresolved point
- In re-judgment conditions, include completion of operational owner nomination as an explicit trigger

【Responsibility Unresolved / Review】
- Do not treat unresolved points as general information deficiencies; expose unfixed roles themselves
- Priority unresolved point candidates to observe:
  1. Whether final owner is truly confirmed (cross-check against main text, do not accept frontContext at face value)
  2. Whether stop authority is explicitly stated (same as or different from final decision-maker?)
  3. Whether operational owner is explicitly stated (to department/role level)
  4. Whether approval / use / oversight role separation is explicit (if not, treat absence as unresolved)
- Even if unresolvedPoints is empty, output any of the above as unresolved if unfixed
- Re-judgment conditions must center on "which responsibility role is unfixed, what is needed to fix it":
  - Which role is unfixed (stop authority / operational owner / role separation)
  - What agreement / nomination / rule-setting completion enables re-judgment
  - By when (specific deadline or milestone)
  - Who leads the fixing and who makes the final re-judgment

` : ''}`
    : '';

  const premisesLines = mc
    ? [
        !isUnsetCondition(mc.owner) ? `- Final decision-maker: ${mc.owner} (final decision-making party for this session)` : '',
        !isUnsetCondition(mc.timeHorizon) ? `- Decision deadline: ${mc.timeHorizon} (treat as a decision deadline, not reference information)` : '',
        !isUnsetCondition(mc.budgetSource) ? `- Budget / investment scope: ${mc.budgetSource} (treat as a constraint for allocation decisions)` : '',
      ].filter(Boolean)
    : [];

  const decisionPremisesBlock = premisesLines.length > 0
    ? `【Decision Premises】\n${premisesLines.join('\n')}\n\n`
    : '';

  return `Please compress the following input into a decision-ready object.

${frontContextBlock}${frontGuidanceBlock}${decisionPremisesBlock}【Section 1: Decision Overview】
- Stalled situation: ${q1}
- Desired outcome: ${isPreAdoptionFinal ? 'Compare and judge adoption options (full adoption / limited adoption / deferral / halt)' : q2}
- Number of issues: ${issueCount}${hasDependencies ? ' (issues are interdependent)' : ''}

【Section 2: Decision Unit Elements】

■ Problems (phenomena already occurring)
${problemsText}

■ Tasks (decision items for this round)
${tasksText}

■ Decision conditions
- Final decision-maker: ${displayOwner}
- Decision deadline: ${displayTimeHorizon}
- Decision criteria: ${displayDecisionRule}

【Section 3: Decision Compression Request】

【Undetermined points】
${unresolvedText}
${frontContext?.effectiveType === 'responsibility_structure' ? `
【Responsibility Structure Checklist (unfixed elements not in raw payload)】
The following are responsibility structure items to observe from the main text.
Even if unresolvedPoints is empty, treat these as part of the decision unit to fix if unfixed:
- Stop authority: who can declare "stop"
- Operational owner: which department/role handles operations
- Role separation status (approval / use / oversight): whether these roles are separated
` : ''}
【Structured decision condition data (raw)】
\`\`\`json
${JSON.stringify(rawPayload, null, 2)}
\`\`\`

【Questions】
- What is the decision unit to be locked from this input?
- What issues should not be decided this time?
- What is the minimum set of decision axes to compare?
- What are the trade-offs of each option?
- Even with undetermined points remaining, how far can a decision be made at this point?

【Request】
Compress according to the following conditions:
- Fix only the unit that should be decided this time
- Do not fill undetermined points with inference; make them explicit as undetermined (refer to null in structured data)
- Generate comparable decision surfaces, not generic advice
- Attach to each option: "the conditions that, if confirmed, lead to adopting this option" (observable judgment conditions)
- Make trade-offs explicit (including exit cost vs. continuation cost vs. opportunity loss)
- Separate what is not being decided this time
- If a decision cannot be made this time, always include: "what must be in place for re-judgment" and "when / who triggers re-judgment"
- Handle sunk costs not as emotional "waste" but as: "whether to include in the ongoing decision or separate" and "whether existing assets can be reused"${frontContext?.effectiveType !== 'pre_adoption' ? `
- When presenting continuation / scale-down / stop together, "scale-down" must not be hold or wait-and-see; write as an independent operational state with what to stop and what to keep explicitly stated
- Write continuation and stop each with observable adoption conditions ("if X is confirmed → continuation" / "if X cannot be confirmed → stop")` : ''}
- Re-judgment conditions must always include 3 points: "what must be in place / when / who"

Output format:
Please output in Markdown format with the following 3 blocks:

1. Locked decision unit
2. Decision Surface
3. Re-judgment conditions

Do not output in JSON format or code block format.`;
}
