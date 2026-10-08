/**
 * 使用数据统计：只读汇总当前用户的真实使用记录，不做任何推测或补数。
 *
 * 指标口径：
 * - 建议采纳率 = accepted / (accepted + rejected)，pending 不计入分母；
 * - 采纳前改写率 = 被采纳的建议中，用户先编辑再采纳的比例；
 * - 待确认建议 = 模型或校验层标记 needs_user_input 的建议（无证据技能、新数字等）；
 * - JD → 材料耗时 = 岗位创建到首次生成官网材料包的分钟数（中位数）。
 */

export const METRIC_QUERIES = {
  jobsByStatus: `
    SELECT status, COUNT(*) AS count
    FROM jobs WHERE user_id = ?
    GROUP BY status`,
  tuneRuns: `
    SELECT COUNT(*) AS runs,
           COUNT(DISTINCT job_id) AS jobs,
           SUM(CASE WHEN status = 'finalized' THEN 1 ELSE 0 END) AS finalized,
           SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
    FROM tune_runs WHERE user_id = ?`,
  suggestionsBySection: `
    SELECT section_key AS sectionKey,
           COUNT(*) AS total,
           SUM(CASE WHEN state = 'accepted' THEN 1 ELSE 0 END) AS accepted,
           SUM(CASE WHEN state = 'rejected' THEN 1 ELSE 0 END) AS rejected,
           SUM(CASE WHEN state = 'pending' THEN 1 ELSE 0 END) AS pending,
           SUM(CASE WHEN state = 'accepted' AND edited_text IS NOT NULL
                     AND edited_text <> proposed_text THEN 1 ELSE 0 END) AS acceptedWithEdit,
           SUM(CASE WHEN needs_user_input = 1 THEN 1 ELSE 0 END) AS needsUserInput
    FROM tune_suggestions WHERE user_id = ?
    GROUP BY section_key`,
  minutesToFirstPack: `
    SELECT (julianday(MIN(p.created_at)) - julianday(j.created_at)) * 1440 AS minutes
    FROM jobs j
    JOIN application_packs p ON p.job_id = j.id AND p.user_id = j.user_id
    WHERE j.user_id = ?
    GROUP BY j.id`,
  customAnswers: `
    SELECT COUNT(*) AS count FROM custom_answers WHERE user_id = ?`,
} as const;

type StatusRow = { status: string; count: number };
type RunRow = { runs: number; jobs: number; finalized: number | null; failed: number | null };
type SectionRow = {
  sectionKey: string;
  total: number;
  accepted: number;
  rejected: number;
  pending: number;
  acceptedWithEdit: number;
  needsUserInput: number;
};

export type MetricRows = {
  jobsByStatus: StatusRow[];
  tuneRuns: RunRow | null;
  suggestionsBySection: SectionRow[];
  minutesToFirstPack: Array<{ minutes: number | null }>;
  customAnswers: { count: number } | null;
};

const PIPELINE_ORDER = ['wishlist', 'applied', 'assessment', 'interview', 'offer', 'closed'] as const;

function rate(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : null;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return Math.round(value * 10) / 10;
}

/** section_key 在库中编码为 "operation:section"，例如 "replace:experience"。 */
function splitSectionKey(value: string) {
  const [operation, section] = value.includes(':') ? value.split(':', 2) : ['replace', value];
  return { operation, section };
}

export function summarizeMetrics(rows: MetricRows) {
  const statusCounts = Object.fromEntries(PIPELINE_ORDER.map((status) => [status, 0])) as Record<string, number>;
  for (const row of rows.jobsByStatus) statusCounts[row.status] = Number(row.count) || 0;
  const jobsTotal = Object.values(statusCounts).reduce((sum, value) => sum + value, 0);
  const submitted = jobsTotal - statusCounts.wishlist;
  const pastScreening = statusCounts.assessment + statusCounts.interview + statusCounts.offer;

  const totals = { total: 0, accepted: 0, rejected: 0, pending: 0, acceptedWithEdit: 0, needsUserInput: 0 };
  const bySection = new Map<string, typeof totals>();
  for (const row of rows.suggestionsBySection) {
    const { operation, section } = splitSectionKey(row.sectionKey);
    const key = `${section}/${operation}`;
    const bucket = bySection.get(key) || { total: 0, accepted: 0, rejected: 0, pending: 0, acceptedWithEdit: 0, needsUserInput: 0 };
    for (const field of Object.keys(totals) as Array<keyof typeof totals>) {
      const value = Number(row[field]) || 0;
      bucket[field] += value;
      totals[field] += value;
    }
    bySection.set(key, bucket);
  }

  const minutes = rows.minutesToFirstPack
    .map((row) => Number(row.minutes))
    .filter((value) => Number.isFinite(value) && value >= 0);

  return {
    pipeline: {
      jobs: jobsTotal,
      byStatus: statusCounts,
      submitted,
      pastScreening,
      pastScreeningRatePct: rate(pastScreening, submitted),
    },
    tuning: {
      runs: Number(rows.tuneRuns?.runs) || 0,
      jobsTuned: Number(rows.tuneRuns?.jobs) || 0,
      finalizedRuns: Number(rows.tuneRuns?.finalized) || 0,
      failedRuns: Number(rows.tuneRuns?.failed) || 0,
    },
    suggestions: {
      ...totals,
      acceptanceRatePct: rate(totals.accepted, totals.accepted + totals.rejected),
      editBeforeAcceptRatePct: rate(totals.acceptedWithEdit, totals.accepted),
      needsUserInputSharePct: rate(totals.needsUserInput, totals.total),
      bySection: [...bySection.entries()]
        .map(([key, value]) => ({
          key,
          ...value,
          acceptanceRatePct: rate(value.accepted, value.accepted + value.rejected),
        }))
        .sort((a, b) => b.total - a.total),
    },
    applicationPack: {
      jobsWithPack: minutes.length,
      medianMinutesFromJobToPack: median(minutes),
      customAnswers: Number(rows.customAnswers?.count) || 0,
    },
  };
}

export type MetricsSummary = ReturnType<typeof summarizeMetrics>;

export async function loadMetrics(database: D1Database, userId: string): Promise<MetricsSummary> {
  const [jobsByStatus, tuneRuns, suggestionsBySection, minutesToFirstPack, customAnswers] = await Promise.all([
    database.prepare(METRIC_QUERIES.jobsByStatus).bind(userId).all<StatusRow>(),
    database.prepare(METRIC_QUERIES.tuneRuns).bind(userId).first<RunRow>(),
    database.prepare(METRIC_QUERIES.suggestionsBySection).bind(userId).all<SectionRow>(),
    database.prepare(METRIC_QUERIES.minutesToFirstPack).bind(userId).all<{ minutes: number | null }>(),
    database.prepare(METRIC_QUERIES.customAnswers).bind(userId).first<{ count: number }>(),
  ]);
  return summarizeMetrics({
    jobsByStatus: jobsByStatus.results,
    tuneRuns,
    suggestionsBySection: suggestionsBySection.results,
    minutesToFirstPack: minutesToFirstPack.results,
    customAnswers,
  });
}
