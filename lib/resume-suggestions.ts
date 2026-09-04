import type { ResumeContent } from '@/lib/product-types';

export type ResumeSuggestionOperation = 'replace' | 'append' | 'delete';
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
  return operation === 'replace' ? section : `${operation}:${section}`;
}

export function parseSuggestionSection(value: string): {
  operation: ResumeSuggestionOperation;
  section: ResumeSuggestionSection;
  label: string;
} {
  const [prefix, prefixedSection] = value.split(':', 2);
  const operation: ResumeSuggestionOperation = prefix === 'append'
    ? 'append'
    : prefix === 'delete'
      ? 'delete'
      : 'replace';
  const raw = (operation === 'replace' ? value : prefixedSection) as ResumeSuggestionSection;
  const section = raw in SECTION_LABELS ? raw : 'extras';
  return {
    operation,
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

  if (target.operation === 'delete') {
    if (!originalText) return content;
    return nextText
      ? replaceDeep(content, originalText, nextText) as ResumeContent
      : deleteDeep(content, originalText) as ResumeContent;
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

export function resumeContainsExactText(value: unknown, target: string): boolean {
  if (!target) return false;
  if (typeof value === 'string') return value === target;
  if (Array.isArray(value)) return value.some((item) => resumeContainsExactText(item, target));
  if (value && typeof value === 'object') {
    return Object.values(value).some((item) => resumeContainsExactText(item, target));
  }
  return false;
}

export function canDeleteResumeText(
  content: ResumeContent,
  section: ResumeSuggestionSection,
  target: string,
): boolean {
  if (!target) return false;
  if (section === 'summary') return content.summary === target;
  if (section === 'skills') return content.skills.includes(target);
  if (section === 'extras') return content.extras.includes(target);
  if (section === 'experience') {
    return content.experiences.some((entry) => entry.bullets.includes(target));
  }
  return content.projects.some((entry) => entry.bullets.includes(target));
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

function deleteDeep(value: unknown, target: string): unknown {
  if (typeof value === 'string') return value === target ? '' : value;
  if (Array.isArray(value)) {
    return value
      .map((item) => deleteDeep(item, target))
      .filter((item) => item !== '');
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, deleteDeep(item, target)]),
    );
  }
  return value;
}
