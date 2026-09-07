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
  const nextText = normalizeSuggestedResumeText(
    target.section,
    originalText,
    proposedText,
  );

  if (target.operation === 'append') {
    if (!nextText || (target.section !== 'skills' && target.section !== 'extras')) return content;
    const lines = target.section === 'skills' ? content.skills : content.extras;
    if (!lines.some((line) => line.trim() === nextText)) lines.push(nextText);
    return content;
  }

  if (target.operation === 'delete') {
    if (!originalText) return content;
    return nextText
      ? replaceSectionText(content, target.section, originalText, nextText)
      : deleteSectionText(content, target.section, originalText);
  }

  if (!originalText || !nextText) return content;
  return replaceSectionText(content, target.section, originalText, nextText);
}

export function normalizeSuggestedResumeText(
  section: ResumeSuggestionSection,
  originalText: string,
  proposedText: string,
) {
  const compact = proposedText
    .replace(/\r?\n+\s*(?:[-–—•·▪]|\d+[.)、])\s*/g, '；')
    .replace(/\r?\n+/g, ' ')
    .replace(/^\s*(?:[-–—•·▪]|\d+[.)、])\s*/, '')
    .replace(/\*\*|__|\\textbf\s*\{([^}]*)\}/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!compact || (section !== 'experience' && section !== 'project')) {
    return compact;
  }

  const original = splitBulletLead(originalText);
  const proposed = splitBulletLead(compact);
  if (original.lead) {
    const separator = original.lead.endsWith(':') ? ' ' : '';
    return `${original.lead}${separator}${proposed.lead ? proposed.rest : compact}`.trim();
  }
  return proposed.lead ? proposed.rest.trim() : compact;
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

export function canEditResumeText(
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

function replaceSectionText(
  content: ResumeContent,
  section: ResumeSuggestionSection,
  from: string,
  to: string,
) {
  if (section === 'summary') {
    if (content.summary === from) content.summary = to;
  } else if (section === 'skills') {
    replaceFirst(content.skills, from, to);
  } else if (section === 'extras') {
    replaceFirst(content.extras, from, to);
  } else {
    const entries = section === 'experience' ? content.experiences : content.projects;
    for (const entry of entries) {
      if (replaceFirst(entry.bullets, from, to)) break;
    }
  }
  return content;
}

function deleteSectionText(
  content: ResumeContent,
  section: ResumeSuggestionSection,
  target: string,
) {
  if (section === 'summary') {
    if (content.summary === target) content.summary = '';
  } else if (section === 'skills') {
    deleteFirst(content.skills, target);
  } else if (section === 'extras') {
    deleteFirst(content.extras, target);
  } else {
    const entries = section === 'experience' ? content.experiences : content.projects;
    for (const entry of entries) {
      if (deleteFirst(entry.bullets, target)) break;
    }
  }
  return content;
}

function replaceFirst(values: string[], from: string, to: string) {
  const index = values.indexOf(from);
  if (index < 0) return false;
  values[index] = to;
  return true;
}

function deleteFirst(values: string[], target: string) {
  const index = values.indexOf(target);
  if (index < 0) return false;
  values.splice(index, 1);
  return true;
}

function splitBulletLead(value: string) {
  const match = value.trim().match(/^([^：:\n]{1,12}[：:])\s*(.+)$/);
  return match
    ? { lead: match[1], rest: match[2] }
    : { lead: '', rest: value.trim() };
}
