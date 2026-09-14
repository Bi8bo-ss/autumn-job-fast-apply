import type { ApplicationPackContent } from '@/lib/product-types';

export function applicationPackFromJson(raw?: string | null): ApplicationPackContent | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<ApplicationPackContent>;
    if (typeof value.selfEvaluation !== 'string' || typeof value.selfIntroduction !== 'string' || typeof value.motivation !== 'string') return null;
    return { groups: Array.isArray(value.groups) ? value.groups : [], missingFields: [], selfEvaluation: value.selfEvaluation, selfIntroduction: value.selfIntroduction, motivation: value.motivation };
  } catch { return null; }
}
