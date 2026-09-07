import type { ResumeContent } from '@/lib/product-types';

export type ResumeSuggestionOperation = 'replace' | 'append' | 'delete' | 'merge';
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
      : prefix === 'merge'
        ? 'merge'
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
    target.operation === 'merge' ? '' : originalText,
    proposedText,
    source.language,
  );

  if (target.operation === 'append') {
    if (!nextText) return content;
    if (target.section === 'skills' || target.section === 'extras') {
      const lines = target.section === 'skills' ? content.skills : content.extras;
      if (!lines.some((line) => line.trim() === nextText)) lines.push(nextText);
      return content;
    }
    if (target.section !== 'experience' && target.section !== 'project') return content;
    const entries = target.section === 'experience' ? content.experiences : content.projects;
    for (const entry of entries) {
      if (!entry.bullets.includes(originalText)) continue;
      if (!entry.bullets.some((line) => line.trim() === nextText)) entry.bullets.push(nextText);
      break;
    }
    return content;
  }

  if (target.operation === 'delete') {
    if (!originalText) return content;
    return nextText
      ? replaceSectionText(content, target.section, originalText, nextText)
      : deleteSectionText(content, target.section, originalText);
  }

  if (target.operation === 'merge') {
    const sourceTexts = decodeMergeSourceTexts(originalText);
    if (!nextText || sourceTexts.length < 2) return content;
    return mergeSectionTexts(content, target.section, sourceTexts, nextText);
  }

  if (!originalText || !nextText) return content;
  return replaceSectionText(content, target.section, originalText, nextText);
}

export function normalizeSuggestedResumeText(
  section: ResumeSuggestionSection,
  originalText: string,
  proposedText: string,
  language?: ResumeContent['language'],
) {
  const compact = cleanText(proposedText);

  if (!compact || (section !== 'experience' && section !== 'project')) {
    return compact;
  }

  const original = splitBulletLead(originalText);
  const proposed = splitBulletLead(compact);
  if (proposed.lead) {
    return joinBullet(proposed.lead, proposed.rest, language || inferLanguage(compact));
  }
  if (original.lead) {
    return joinBullet(original.lead, compact, language || inferLanguage(originalText));
  }
  return ensureResumeBulletLead(compact, language || inferLanguage(compact));
}

export function hasResumeBulletLead(value: string) {
  return Boolean(splitBulletLead(cleanText(value)).lead);
}

export function resumeBulletParts(value: string, language: ResumeContent['language']) {
  const compact = cleanText(value);
  const parsed = splitBulletLead(compact);
  const label = parsed.lead || inferBulletLead(parsed.rest, language);
  return {
    lead: `${label}${language === 'zh' ? '：' : ':'}`,
    rest: parsed.rest,
  };
}

export function ensureResumeBulletLead(value: string, language: ResumeContent['language']) {
  const { lead, rest } = resumeBulletParts(value, language);
  return `${lead}${language === 'en' ? ' ' : ''}${rest}`.trim();
}

export function ensureResumeBulletLeads(content: ResumeContent): ResumeContent {
  const next = structuredClone(content);
  for (const entry of [...next.experiences, ...next.projects]) {
    entry.bullets = entry.bullets.map((bullet) => ensureResumeBulletLead(bullet, next.language));
  }
  return next;
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

export function encodeMergeSourceTexts(values: string[]) {
  return JSON.stringify([...new Set(values.map((value) => value.trim()).filter(Boolean))]);
}

export function decodeMergeSourceTexts(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()));
  } catch {
    return [];
  }
}

export function canMergeResumeTexts(
  content: ResumeContent,
  section: ResumeSuggestionSection,
  sourceTexts: string[],
) {
  if ((section !== 'experience' && section !== 'project') || sourceTexts.length < 2) return false;
  const unique = [...new Set(sourceTexts)];
  if (unique.length !== sourceTexts.length) return false;
  const entries = section === 'experience' ? content.experiences : content.projects;
  return entries.some((entry) => unique.every((text) => entry.bullets.includes(text)));
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

function mergeSectionTexts(
  content: ResumeContent,
  section: ResumeSuggestionSection,
  sourceTexts: string[],
  replacement: string,
) {
  if (section !== 'experience' && section !== 'project') return content;
  const entries = section === 'experience' ? content.experiences : content.projects;
  const unique = [...new Set(sourceTexts)];
  for (const entry of entries) {
    if (!unique.every((text) => entry.bullets.includes(text))) continue;
    const firstIndex = entry.bullets.indexOf(unique[0]);
    const removed = new Set(unique);
    entry.bullets = entry.bullets.filter((text) => !removed.has(text));
    entry.bullets.splice(Math.min(firstIndex, entry.bullets.length), 0, replacement);
    break;
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
  const match = value.trim().match(/^([^：:\n]{1,18})[：:]\s*(.+)$/);
  return match
    ? { lead: match[1].trim(), rest: match[2].trim() }
    : { lead: '', rest: value.trim() };
}

function cleanText(value: string) {
  return value
    .replace(/\r?\n+\s*(?:[-–—•·▪]|\d+[.)、])\s*/g, '；')
    .replace(/\r?\n+/g, ' ')
    .replace(/^\s*(?:[-–—•·▪]|\d+[.)、])\s*/, '')
    .replace(/\*\*|__|\\textbf\s*\{([^}]*)\}/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function joinBullet(lead: string, rest: string, language: ResumeContent['language']) {
  return `${lead.trim()}${language === 'zh' ? '：' : ': '}${rest.trim()}`.trim();
}

function inferLanguage(value: string): ResumeContent['language'] {
  return /[\u3400-\u9fff]/.test(value) ? 'zh' : 'en';
}

function inferBulletLead(value: string, language: ResumeContent['language']) {
  if (language === 'en') {
    if (/collaborat|stakeholder|cross-functional|partner/i.test(value)) return 'Collaboration';
    if (/automat|efficien|reduc|accelerat|optim/i.test(value)) return 'Efficiency';
    if (/analy|metric|dashboard|sql|python|model|experiment/i.test(value)) return 'Analytics';
    if (/research|survey|interview|persona|journey/i.test(value)) return 'Research';
    if (/design|build|develop|implement|launch/i.test(value)) return 'Delivery';
    return 'Impact';
  }
  if (/协同|对接|沟通|统一.+口径|跨部门/.test(value)) return '协同推进';
  if (/自动化|效率|耗时|压缩|提效|缩短/.test(value)) return '效率优化';
  if (/看板|指标|监控|覆盖率|渗透率|达成率/.test(value)) return '指标体系';
  if (/SQL|Python|模型|聚类|实验|检验|ANOVA|数据分析/i.test(value)) return '数据分析';
  if (/用户|需求|Persona|Journey|PRD|体验/.test(value)) return '用户研究';
  if (/流程|BPMN|DFD|ERD|系统|内控/.test(value)) return '流程优化';
  if (/调研|研究|洞察/.test(value)) return '业务洞察';
  if (/搭建|开发|构建|实现|设计/.test(value)) return '方案搭建';
  if (/推进|落地|统筹|负责|承接/.test(value)) return '项目推进';
  return '成果产出';
}
