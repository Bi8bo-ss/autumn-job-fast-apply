/* oxlint-disable eslint/no-control-regex -- Resume normalization intentionally strips control characters. */
import type { ResumeContent } from './product-types';
import { mergeResumeSkillLines } from './resume-skills';

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
const SKILL_ROW_LABELS = ['语言', '语言能力', '软件', '软件技能', '工具', '工具技能', '数据工具', '技术技能', '专业', '专业技能', '研究与方法', '方法', '应用', 'languages', 'language', 'software', 'tools', 'technical skills', 'professional skills', 'research methods'];
const SKILL_ROW_PATTERN = SKILL_ROW_LABELS
  .sort((a, b) => b.length - a.length)
  .map((label) => /^[\u3400-\u9fff]+$/.test(label) ? label.split('').join('[ \\t]*') : escapeRegExp(label).replace(/ /g, '[ \\t]+'))
  .join('|');
const SKILL_ROW_START_RE = new RegExp(`(^|[\\s；;])(${SKILL_ROW_PATTERN})[ \\t]*[：:]`, 'gi');
const SKILL_ROW_RE = new RegExp(`^(?:${SKILL_ROW_PATTERN})[ \\t]*[：:]`, 'i');
const DATE_RE = /(?:19|20)\d{2}(?:[.\-/年]\d{1,2})?/;
const DATE_RANGE_RE = /(?:19|20)\d{2}(?:[.\-/年]\d{1,2})?\s*(?:--?|–|—|至|~)\s*(?:(?:19|20)\d{2}(?:[.\-/年]\d{1,2})?|至今|present|now)/i;
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
  return value
    .replace(/^[•●▪◦·*✓✔➢►▶◆◇■□\-–—]+\s*/, '')
    .replace(/^[：:]\s*/, '')
    .replace(/\s+([，。；：、！？）】])/g, '$1')
    .replace(/([（【])\s+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanBodyLine(value: string) {
  return cleanLine(value).replace(/([\u3400-\u9fff]) (?=[\u3400-\u9fff])/g, '$1');
}

export function isLikelySupplementalNoise(value: string, language: Language) {
  const line = cleanBodyLine(value);
  if (!line || /^[^：:]{1,20}[：:]\s*$/.test(line) || /�/.test(line)) return true;
  const compact = line.replace(/\s+/g, '').toLowerCase();

  if (language === 'zh') {
    for (let size = 2; size <= Math.min(6, Math.floor(compact.length / 2)); size += 1) {
      for (let index = 0; index + size * 2 <= compact.length; index += 1) {
        const word = compact.slice(index, index + size);
        // This heuristic is for repeated Chinese extraction fragments only.
        // MySQL, SQL, contains "sql,sql," but is two distinct, valid skills.
        if (/^[\u3400-\u9fff]+$/.test(word)
          && word === compact.slice(index + size, index + size * 2)) return true;
      }
    }
    if (!/[：:，,、；;（）()/]/.test(line) && line.length >= 8 && line.length <= 40) {
      const keywordCount = (line.match(/项目|统筹|物流|协调|运营|管理|分析|数据|业务|用户|流程|策略|研究|能力|技能/g) || []).length;
      if (keywordCount >= 3) return true;
    }
  } else if (/\b([a-z][a-z-]{2,})\s+\1\b/i.test(line)) {
    return true;
  }

  return false;
}

export function normalizeResumeSkillLine(value: string, language: Language) {
  let line = cleanBodyLine(value);
  // Old PDF imports appended out-of-order experience labels after the final
  // sentence of a labeled skill row. Remove only a noisy suffix, never its facts.
  const end = line.lastIndexOf('。');
  const suffix = end >= 0 ? line.slice(end + 1).trim() : '';
  if (/^[^：:]{1,32}[：:]/.test(line) && suffix && !/[：:]/.test(suffix)
    && isLikelySupplementalNoise(suffix, language)) line = line.slice(0, end + 1);
  const match = line.match(/^(?:技能确认|待确认技能|skill confirmation|skill check)\s*[：:]\s*(.+)$/i);
  if (!match) return line;
  const skill = match[1].trim();
  if (language === 'en') {
    const category = /interview|research|survey|experiment|test|model|statistic|analysis|method/i.test(skill)
      ? 'Research Methods'
      : /tableau|power\s*bi|excel|sql|python|r\b|looker|figma|java|javascript|matlab|spss|sas/i.test(skill)
        ? 'Tools'
        : 'Professional Skills';
    return `${category}: ${skill}`;
  }
  const category = /访谈|调研|问卷|实验|测试|检验|建模|统计|分析|研究|方法|归因|聚类|预测/.test(skill)
    ? '研究与方法'
    : /Tableau|Power\s*BI|Excel|SQL|Python|Looker|Figma|Java|JavaScript|MATLAB|SPSS|SAS|工具|软件/i.test(skill)
      ? '工具技能'
      : '专业技能';
  return `${category}：${skill}`;
}

function cleanSupplementalLines(lines: string[], language: Language, kind: 'skills' | 'extras') {
  const seen = new Set<string>();
  return lines
    .map(cleanBodyLine)
    .map((line) => kind === 'skills' ? normalizeResumeSkillLine(line, language) : line)
    // Original skills are confirmed source facts, not AI suggestions. A repeated
    // extraction fragment or an unresolved glyph must not erase the entire row.
    .filter((line) => kind === 'skills'
      ? Boolean(line) && !/^[^：:]{1,32}[：:]\s*$/.test(line)
      : !isLikelySupplementalNoise(line, language))
    .filter((line) => {
      const key = line.replace(/\s+/g, '').toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function prepareLines(text: string) {
  let prepared = text
    .replace(/\u0000/g, '')
    .replace(/\f/g, '\n')
    .replace(/\r/g, '\n')
    // Legacy PDF text can put every category on one physical line. Restore
    // category boundaries before looking for headings inside the source text.
    .replace(SKILL_ROW_START_RE, (match: string, boundary: string, label: string, offset: number, input: string) => {
      // A “软件：…” experience bullet is not a standalone skills category.
      if (/(?:^|[\r\n]|[ \t]{2,})[•●▪◦·*✓✔➢►▶◆◇■□\-–—]+[ \t]*$/.test(input.slice(0, offset))) return match;
      return `${/[；;]/.test(boundary) ? boundary : ''}\n${cleanBodyLine(label)}：`;
    })
    .replace(INLINE_SECTION_RE, (match: string, label: string, offset: number, input: string) => {
      const prefix = input.slice(input.lastIndexOf('\n', offset - 1) + 1, offset);
      const after = input.slice(offset + match.length);
      const labeledRow = SKILL_ROW_RE.test(`${label}${after}`) && /^[：:][ \t]*[^\s]/.test(after);
      const separateHeading = /(?:[\n\r|｜]|[ \t]{2,})$/.test(`${prefix}${match.slice(0, -label.length)}`)
        && (label.length > 2 || /^[：:]?(?:[ \t]*\n|[ \t]*$)/.test(after));
      // “项目 管理” inside a professional row is a skill, not “项目” followed
      // by a new project section. Also retain labeled “专业技能：…” rows.
      if (labeledRow || (SKILL_ROW_RE.test(prefix) && !separateHeading)) return match;
      return `\n${label}\n`;
    })
    .replace(/\s*[•●▪◦✓✔➢►▶◆◇■□]\s*/g, '\n• ')
    // PDF text extraction often converts list bullets into spaced hyphens.
    // Date ranges and words such as “平台-服务商” have no surrounding spaces,
    // so this only restores real list boundaries.
    .replace(/(?:[ \t]{2,}-[ \t]+|[ \t]+-[ \t]{2,})(?=[：:\p{L}\p{N}\u3400-\u9fff])/gu, '\n• ')
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

function joinSkillSourceLines(lines: string[]) {
  const joined: string[] = [];
  for (const raw of lines) {
    const line = cleanLine(raw);
    const previous = joined.at(-1);
    // PDF wraps may split “User Behavior Analysis” across physical lines.
    // Continue the labeled row until the next category, retaining its words.
    if (previous && /^[^：:]{1,32}[：:]/.test(previous) && !/^[^：:]{1,32}[：:]/.test(line)) {
      joined[joined.length - 1] = `${previous} ${line}`;
    } else if (line) joined.push(line);
  }
  return joined;
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
      current.bullets.push(cleanBodyLine(line));
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

function normalizeEntry(entry: ResumeContent['experiences'][number]) {
  let heading = cleanLine(entry.heading).replace(/[|｜]\s*$/, '').trim();
  const rawMeta = cleanLine(entry.meta);
  const match = rawMeta.match(DATE_RANGE_RE);
  let meta = rawMeta;
  const recoveredBullets: string[] = [];

  if (match && match.index !== undefined) {
    const before = cleanLine(rawMeta.slice(0, match.index)).replace(/[|｜,，·\s]+$/, '');
    const after = cleanLine(rawMeta.slice(match.index + match[0].length)).replace(/^[|｜,，:：;；·\s]+/, '');
    meta = match[0].replace(/\s*(?:--?|–|—|至|~)\s*/, ' - ');
    if (before && !heading.includes(before)) heading = `${heading}｜${before}`;
    if (after) recoveredBullets.push(after);
  } else if (rawMeta.length > 48) {
    meta = '';
    recoveredBullets.push(rawMeta);
  }

  return {
    heading,
    meta,
    bullets: [...recoveredBullets, ...entry.bullets].map(cleanBodyLine).filter(Boolean),
  };
}

export function parseResumeText(text: string, language: Language): ResumeContent {
  const buckets: Record<Section, string[]> = {
    preamble: [], summary: [], education: [], experiences: [], projects: [], skills: [], extras: [],
  };
  let section: Section = 'preamble';
  for (const line of prepareLines(text)) {
    if (SKILL_ROW_RE.test(line) && !/^[^：:]+[：:]\s*$/.test(line)
      && (section === 'skills' || (section === 'preamble'
        && /^(?:语言|软件|专业|language|software|professional skills)/i.test(line)))) {
      section = 'skills';
      buckets.skills.push(line);
      continue;
    }
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
    skills: cleanSupplementalLines(joinSkillSourceLines(buckets.skills), language, 'skills'),
    extras: cleanSupplementalLines([...overflow, ...splitList(buckets.extras)], language, 'extras'),
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
  const hasOversizedLine = [content.headline, content.summary, ...content.education, ...content.skills, ...content.extras,
    ...content.experiences.flatMap((entry) => [entry.heading, entry.meta]),
    ...content.projects.flatMap((entry) => [entry.heading, entry.meta])]
    .some((line) => line.length > 240);
  const degenerate = content.headline.length > 80 || hasOversizedLine || structuredCount === 0;
  const sourceParsed = sourceText?.trim() ? parseResumeText(sourceText.trim(), content.language) : null;
  const parsed = degenerate ? sourceParsed || parseResumeText(resumeContentToText(content), content.language) : content;
  return {
    ...parsed,
    headline: cleanLine(parsed.headline),
    summary: cleanLine(parsed.summary),
    education: parsed.education.map(cleanLine).filter(Boolean),
    experiences: parsed.experiences.map(normalizeEntry),
    projects: parsed.projects.map(normalizeEntry),
    // Keep every skill recovered from the original source. A tailored version may
    // rewrite a skill line, but a job-specific edit must not erase useful tools.
    skills: mergeResumeSkillLines(
      cleanSupplementalLines([...(sourceParsed?.skills || []), ...parsed.skills], parsed.language, 'skills'),
      parsed.language,
    ),
    extras: cleanSupplementalLines(parsed.extras, parsed.language, 'extras'),
  };
}
