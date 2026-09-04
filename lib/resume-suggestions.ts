import type { ResumeContent } from '@/lib/product-types';

export type ResumeSuggestionOperation = 'replace' | 'append';
export type ResumeSuggestionSection = 'summary' | 'experience' | 'project' | 'skills' | 'extras';

const SECTION_LABELS: Record<ResumeSuggestionSection, string> = {
  summary: '个人概述',
  experience: '实习经历',
  project: '项目经历',
  skills: '技能',
  extras: '其他信息',
};

export function encodeSuggestionSection(
  operation: ResumeSuggestionOperation,
  section: ResumeSuggestionSection,
) {
  return operation === 'append' ? `append:${section}` : section;
}

export function parseSuggestionSection(value: string): {
  operation: ResumeSuggestionOperation;
  section: ResumeSuggestionSection;
  label: string;
} {
  const isAppend = value.startsWith('append:');
  const raw = (isAppend ? value.slice('append:'.length) : value) as ResumeSuggestionSection;
  const section = raw in SECTION_LABELS ? raw : 'extras';
  return {
    operation: isAppend ? 'append' : 'replace',
    section,
    label: SECTION_LABELS[section],
  };
}

export function applyResumeSuggestion(
  source: ResumeContent,
  encodedSection: string,
  originalText: string,
  proposedText: string,
): ResumeContent {
  const content = structuredClone(source);
  const target = parseSuggestionSection(encodedSection);
  const nextText = proposedText.trim();

  if (target.operation === 'append') {
    if (!nextText || (target.section !== 'skills' && target.section !== 'extras')) return content;
    const lines = target.section === 'skills' ? content.skills : content.extras;
    if (!lines.some((line) => line.trim() === nextText)) lines.push(nextText);
    return content;
  }

  if (!originalText || !nextText) return content;
  return replaceDeep(content, originalText, nextText) as ResumeContent;
}

export function resumeContainsText(value: unknown, target: string): boolean {
  if (!target) return false;
  if (typeof value === 'string') return value === target || value.includes(target);
  if (Array.isArray(value)) return value.some((item) => resumeContainsText(item, target));
  if (value && typeof value === 'object') {
    return Object.values(value).some((item) => resumeContainsText(item, target));
  }
  return false;
}

function replaceDeep(value: unknown, from: string, to: string): unknown {
  if (typeof value === 'string') return value === from ? to : value.replace(from, to);
  if (Array.isArray(value)) return value.map((item) => replaceDeep(item, from, to));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, replaceDeep(item, from, to)]),
    );
  }
  return value;
}
