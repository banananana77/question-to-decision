export interface TestCase {
  id: string;
  name: string;
  input: string;
  expected: {
    issueCount: number;
    isMixed: boolean;
    description: string;
  };
}

export const TEST_CASES: TestCase[] = [
  // 単一論点（3件）
  {
    id: 'single_1',
    name: '明確な二択・基準明示',
    input: '来期の新規事業立ち上げに、社内リソースを投入すべきか外部委託すべきか。判断期限は今月末で、判断基準はROIと実行スピードの両立。',
    expected: {
      issueCount: 1,
      isMixed: false,
      description: '単一判断・複数基準',
    },
  },
  {
    id: 'single_2',
    name: '複数基準・単一判断',
    input: '新オフィス移転を決めるにあたり、コスト・通勤利便性・ブランドイメージの3つの観点から評価したい。CEOが今月中に決定する。',
    expected: {
      issueCount: 1,
      isMixed: false,
      description: '単一判断・3つの評価基準',
    },
  },
  {
    id: 'single_3',
    name: '制約付き単一判断',
    input: '予算500万円以内で、マーケティングツールを導入するか、既存システムを改修するか。CFOの承認が必要で、期限は来月末。',
    expected: {
      issueCount: 1,
      isMixed: false,
      description: '予算制約下での単一投資判断',
    },
  },

  // 2論点混在（3件）
  {
    id: 'mixed_2a',
    name: '異なる判断主体',
    input: 'AI導入をCEOが決めたいが、技術選定はCTOの判断が必要。両方とも今月中に決める必要がある。',
    expected: {
      issueCount: 2,
      isMixed: true,
      description: 'CEO判断（導入可否）+ CTO判断（技術選定）',
    },
  },
  {
    id: 'mixed_2b',
    name: '異なる時間軸',
    input: '今月中にAI導入の可否を決め、来期に向けて人材育成計画も立てる必要がある。',
    expected: {
      issueCount: 2,
      isMixed: true,
      description: '今月判断（導入） + 来期判断（人材育成）',
    },
  },
  {
    id: 'mixed_2c',
    name: '依存関係あり',
    input: 'まず予算確保の承認を得てから、AI導入プロジェクトを開始するか決めたい。',
    expected: {
      issueCount: 2,
      isMixed: true,
      description: '予算承認 → AI導入判断（依存関係）',
    },
  },

  // 3論点混在（2件）
  {
    id: 'mixed_3a',
    name: 'AI導入・人材・予算の混在',
    input: 'AI導入を進めたいが、既存社員のスキル不足が心配。一方で競合が先行しており、今すぐ動かないと市場シェアを失う。ただ、AI人材の採用コストが予算を圧迫するため、CFOが難色を示している。',
    expected: {
      issueCount: 3,
      isMixed: true,
      description: 'AI導入判断 + 人材育成/採用判断 + 予算配分判断',
    },
  },
  {
    id: 'mixed_3b',
    name: '戦略・組織・技術の混在',
    input: '海外展開するか国内深耕するか（戦略）、組織を分社化するか統合維持するか（組織）、クラウド移行するかオンプレ継続するか（技術）、3つとも関連しているが決める人が違う。',
    expected: {
      issueCount: 3,
      isMixed: true,
      description: '戦略判断 + 組織判断 + 技術判断',
    },
  },

  // 誤検知想定（2件）
  {
    id: 'edge_1',
    name: '感情表現混じり',
    input: 'AI導入したいけど本当に困っている。何から手をつければいいのか分からず焦っている。予算もないし、社内も反対している。',
    expected: {
      issueCount: 1,
      isMixed: false,
      description: '感情表現多いが、本質は単一判断（AI導入可否）',
    },
  },
  {
    id: 'edge_2',
    name: '背景説明が長い',
    input: '弊社は創業30年の製造業です。これまで紙ベースの業務フローでしたが、最近の人手不足で業務が回らなくなってきました。若手社員からデジタル化の要望が上がっています。ただ、ベテラン社員は反対しています。そこで、業務システムを導入すべきか検討中です。',
    expected: {
      issueCount: 1,
      isMixed: false,
      description: '背景長いが、判断は単一（システム導入可否）',
    },
  },
];
