import type { ResumeContent } from './product-types';

type SkillGroup = { category: string; items: string[] };

// Compare names without changing the spelling displayed on the resume. Keep
// punctuation inside C++, C#, A/B testing and HTML/CSS, and parenthetical details.
export function skillKey(value: string) {
  return value.replace(/[。.;；]+$/, '').replace(/\s+/g, '').toLowerCase();
}

function splitItems(body: string) {
  const items: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if ('（(['.includes(char)) depth += 1;
    if ('）)]'.includes(char)) depth = Math.max(0, depth - 1);
    if (depth === 0 && /[、,，;；|｜]/.test(char)) {
      items.push(body.slice(start, index));
      start = index + 1;
    }
  }
  items.push(body.slice(start));
  return items.map((item) => item.replace(/[。.;；]+$/, '').trim()).filter(Boolean);
}

export function skillGroups(value: string): SkillGroup[] {
  // A model may return several categories on one line. Never truncate at the
  // second colon (which used to discard everything after “方法：”).
  return value.split(/[；;]\s*(?=[^：:；;\n]{1,32}[：:])/).map((part) => {
    const match = part.trim().match(/^([^：:\n]{1,32})[：:]\s*([\s\S]*)$/);
    return { category: match?.[1].trim() || '', items: splitItems(match ? match[2] : part) };
  });
}

export function skillNames(value: string) {
  return skillGroups(value).flatMap((group) => group.items.map(skillKey));
}

function categoryKey(category: string) {
  const key = skillKey(category);
  if (/^(?:软件|软件技能|工具|工具技能|数据工具|技术工具|tools?|software|technicaltools)$/.test(key)) return 'software';
  if (/^(?:专业|专业技能|professionalskills)$/.test(key)) return 'professional';
  return key;
}

function semanticCategoryFamily(category: string) {
  const key = skillKey(category);
  if (/语言|language/.test(key)) return 'language';
  if (/实验|统计|研究|方法|experiment|statistic|research|method/.test(key)) return 'methods';
  if (/工具|软件|excel|bi|tool|software|technology|technical/.test(key)) return 'tools';
  if (/策略|运营|经营|strategy|operation/.test(key)) return 'operations';
  if (/数据分析|dataanalysis|analytics/.test(key)) return 'data-analysis';
  if (/业务|专业|能力|business|professional/.test(key)) return 'professional';
  return '';
}

export function fitSkillSuggestionToExistingCategories(
  proposedText: string,
  existingLines: string[],
  language: ResumeContent['language'],
) {
  const existingGroups = existingLines.flatMap(skillGroups);
  const existingNames = new Set(existingLines.flatMap(skillNames));
  return skillGroups(proposedText).flatMap(({ category, items }) => {
    const remaining = items.filter((item) => !existingNames.has(skillKey(item)));
    if (!remaining.length) return [];
    const exact = existingGroups.find((group) => category && categoryKey(group.category) === categoryKey(category));
    const family = semanticCategoryFamily(category);
    const summarized = exact || (family
      ? existingGroups.find((group) => semanticCategoryFamily(group.category) === family)
      : undefined);
    const resolvedCategory = summarized?.category || category;
    return `${resolvedCategory ? `${resolvedCategory}${language === 'zh' ? '：' : ': '}` : ''}${remaining.join(language === 'zh' ? '、' : ', ')}`;
  }).join(language === 'zh' ? '；' : '; ');
}

export function mergeSkillSuggestionIntoExistingLines(
  existingLines: string[],
  proposedText: string,
  language: ResumeContent['language'],
) {
  const fitted = fitSkillSuggestionToExistingCategories(proposedText, existingLines, language);
  return fitted ? mergeResumeSkillLines([...existingLines, fitted], language) : [...existingLines];
}

export function mergeResumeSkillLines(lines: string[], language: ResumeContent['language']) {
  const groups: SkillGroup[] = [];
  const categories = new Map<string, SkillGroup>();
  const seen = new Set<string>();
  for (const line of lines) {
    for (const { category, items } of skillGroups(line)) {
      const unique = items.filter((item) => {
        const key = skillKey(item);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (!unique.length) continue;
      const key = categoryKey(category);
      const group = category ? categories.get(key) : undefined;
      if (group) group.items.push(...unique);
      else {
        const next = { category, items: unique };
        groups.push(next);
        if (category) categories.set(key, next);
      }
    }
  }
  return groups.map(({ category, items }) => (
    `${category ? `${category}${language === 'zh' ? '：' : ': '}` : ''}${items.join(language === 'zh' ? '、' : ', ')}`
  ));
}

export function removesExistingSkills(originalText: string, proposedText: string) {
  const proposed = new Set(skillNames(proposedText));
  return skillNames(originalText).some((name) => !proposed.has(name));
}

export function removeExistingSkillNames(proposedText: string, existingTexts: string[]) {
  const existing = new Set(existingTexts.flatMap(skillNames));
  return skillGroups(proposedText).flatMap(({ category, items }) => {
    const remaining = items.filter((item) => !existing.has(skillKey(item)));
    return remaining.length ? [`${category ? `${category}：` : ''}${remaining.join('、')}`] : [];
  }).join('；');
}
