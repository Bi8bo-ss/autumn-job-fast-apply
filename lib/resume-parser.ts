import type { ResumeContent } from './product-types';

type Language = ResumeContent['language'];
type Section = 'preamble' | 'summary' | 'education' | 'experiences' | 'projects' | 'skills' | 'extras';

const SECTION_LABELS: Array<{ section: Section; labels: string[] }> = [
  { section: 'summary', labels: ['个人简介', '个人总结', '自我评价', '职业概述', '求职目标', 'summary', 'profile', 'objective', 'professional summary'] },
  { section: 'education', labels: ['教育背景', '教育经历', '学历背景', '教育', 'education', 'academic background'] },
  { section: 'experiences', labels: ['工作经历', '实习经历', '实践经历', '职业经历', '工作经验', 'experience', 'work experience', 'employment', 'professional experience'] },
  { section: 'projects', labels: ['项目经历', '项目经验', '代表项目', '项目', 'projects', 'project experience', 'selected projects'] },
  { section: 'skills', labels: ['专业技能', '个人技能', '技能专长', '技能', 'skills', 'technical skills', 'core skills'] },
  { section: 'extras', labels: ['证书与奖项', '证书', '奖项', '荣誉', '语言能力', '其他信息', '其他', 'certificates', 'certifications', 'awards', 'honors', 'languages', 'additional information'] },
];

const ALL_LABELS = SECTION_LABELS.flatMap((item) => item.labels).sort((a, b) => b.length - a.length);
const INLINE_SECTION_RE = new RegExp(`(?:^|[\\s|｜])(${ALL_LABELS.map(escapeRegExp).join('|')})(?=[：:\\s|｜]|$)`, 'gi');
const DATE_RE = /(?:19|20)\d{2}(?:[.\-/年]\d{1,2})?/;
const CONTACT_RE = /(?:@|(?:\+?86[-\s]?)?1\d{10}|电话|手机|邮箱|email|tel\.?|linkedin|github|地址)/i;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sectionFor(line: string): Section | null {
  const normalized = line.trim().replace(/[：:|｜\-—_]/g, '').replace(/\s+/g, ' ').toLowerCase();
  for (const item of SECTION_LABELS) {
    if (item.labels.some((label) => normalized === label.toLowerCase())) return item.section;
  }
  return null;
}

function cleanLine(value: string) {
  return value.replace(/^[•●▪◦·*✓✔➢►▶◆◇■□\-–—]+\s*/, '').replace(/\s+/g, ' ').trim();
}

function prepareLines(text: string) {
  let prepared = text
    .replace(/\u0000/g, '')
    .replace(/\f/g, '\n')
    .replace(/\r/g, '\n')
    .replace(INLINE_SECTION_RE, (_match, label: string) => `\n${label}\n`)
    .replace(/\s*[•●▪◦✓✔➢►▶◆◇■□]\s*/g, '\n• ')
    .replace(/[\t\u00a0]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n');

  // Older PDF imports stored an entire section on one line. Sentence and date
  // boundaries give those records enough structure to render as an ATS resume.
  prepared = prepared.replace(/([。；;])\s+(?=[^\n])/g, '$1\n');
  prepared = prepared.replace(/\s+(?=(?:19|20)\d{2}(?:[.\-/年]))/g, '\n');

  return prepared
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => line.length > 320 ? line.split(/(?<=[。；;])\s*/).filter(Boolean) : [line]);
}

function pickHeadline(lines: string[], language: Language) {
  for (const line of lines) {
    const cleaned = cleanLine(line);
    if (!cleaned) continue;
    if (language === 'zh') {
      const name = cleaned.match(/^([\u3400-\u9fff·]{2,8})(?=\s|$|[，,｜|])/);
      if (name) return name[1];
    } else {
      const name = cleaned.match(/^([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){1,3})(?=\s{2,}|\s[|｜]|$)/);
      if (name) return name[1];
    }
    if (CONTACT_RE.test(cleaned)) continue;
    if (cleaned.length <= 60) return cleaned;
  }
  return language === 'zh' ? '个人简历' : 'Resume';
}

function splitList(lines: string[]) {
  return lines.flatMap((line) => {
    const cleaned = cleanLine(line);
    if (!cleaned) return [];
    if (cleaned.length > 100 && /[；;|｜]/.test(cleaned)) {
      return cleaned.split(/[；;|｜]/).map((part) => part.trim()).filter(Boolean);
    }
    return [cleaned];
  });
}

function parseEntries(lines: string[]): ResumeContent['experiences'] {
  const entries: ResumeContent['experiences'] = [];
  let current: ResumeContent['experiences'][number] | null = null;
  const push = () => {
    if (!current) return;
    if (!current.bullets.length && current.meta) current.bullets = [];
    entries.push(current);
    current = null;
  };

  for (const raw of lines) {
    const wasBullet = /^[•●▪◦·*✓✔➢►▶◆◇■□\-–—]+\s*/.test(raw);
    const line = cleanLine(raw);
    if (!line) continue;
    if (!current) {
      current = { heading: line, meta: '', bullets: [] };
      continue;
    }
    if (DATE_RE.test(line) && !current.meta) {
      current.meta = line;
    } else if (wasBullet || line.length > 70 || /[。；;]$/.test(line)) {
      current.bullets.push(line);
    } else if (current.bullets.length || current.meta) {
      push();
      current = { heading: line, meta: '', bullets: [] };
    } else {
      current.heading = `${current.heading} · ${line}`;
    }
  }
  push();
  return entries;
}

export function parseResumeText(text: string, language: Language): ResumeContent {
  const buckets: Record<Section, string[]> = {
    preamble: [], summary: [], education: [], experiences: [], projects: [], skills: [], extras: [],
  };
  let section: Section = 'preamble';
  for (const line of prepareLines(text)) {
    const detected = sectionFor(line);
    if (detected) {
      section = detected;
      continue;
    }
    buckets[section].push(line);
  }

  const headline = pickHeadline(buckets.preamble, language);
  const preambleRemainder = buckets.preamble
    .map(cleanLine)
    .map((line) => line.startsWith(headline) ? line.slice(headline.length).replace(/^[，,|｜\s]+/, '') : line)
    .filter((line) => line && line !== headline);
  const explicitSummary = splitList(buckets.summary).join(' ');
  const summaryParts = explicitSummary ? [explicitSummary] : preambleRemainder.slice(0, 3);
  const summary = summaryParts.join(' · ').slice(0, 800);
  const overflow = explicitSummary ? preambleRemainder : preambleRemainder.slice(3);

  return {
    language,
    headline,
    summary,
    education: splitList(buckets.education),
    experiences: parseEntries(buckets.experiences),
    projects: parseEntries(buckets.projects),
    skills: splitList(buckets.skills),
    extras: [...overflow, ...splitList(buckets.extras)],
  };
}

export function resumeContentToText(content: ResumeContent) {
  const zh = content.language === 'zh';
  return [
    content.headline,
    content.summary,
    content.education.length ? (zh ? '教育背景' : 'Education') : '',
    ...content.education,
    content.experiences.length ? (zh ? '工作经历' : 'Experience') : '',
    ...content.experiences.flatMap((entry) => [entry.heading, entry.meta, ...entry.bullets.map((line) => `• ${line}`)]),
    content.projects.length ? (zh ? '项目经历' : 'Projects') : '',
    ...content.projects.flatMap((entry) => [entry.heading, entry.meta, ...entry.bullets.map((line) => `• ${line}`)]),
    content.skills.length ? (zh ? '专业技能' : 'Skills') : '',
    ...content.skills,
    content.extras.length ? (zh ? '其他信息' : 'Additional Information') : '',
    ...content.extras,
  ].filter(Boolean).join('\n');
}

export function normalizeResumeContent(content: ResumeContent, sourceText?: string): ResumeContent {
  const structuredCount = content.education.length + content.experiences.length + content.projects.length + content.skills.length;
  const hasOversizedLine = [content.headline, content.summary, ...content.education, ...content.skills, ...content.extras]
    .some((line) => line.length > 240);
  const degenerate = content.headline.length > 80 || hasOversizedLine || structuredCount === 0;
  if (!degenerate) return content;
  return parseResumeText(sourceText?.trim() || resumeContentToText(content), content.language);
}
