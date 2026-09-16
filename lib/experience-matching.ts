import type { Profile } from '@/lib/product-types';

export type ExperienceFactMatch = {
  experienceIndex: number;
  organization: string;
  title: string;
  fact: string;
  score: number;
  matchedTerms: string[];
};

/**
 * Pick the strongest facts from each experience without mutating the source
 * profile. The selector is intentionally conservative: an unrelated fact is
 * left out instead of being forced into a job-specific resume.
 */
export function matchExperienceFacts(
  profile: Pick<Profile, 'experiences'>,
  jd: string,
  limitPerExperience = 5,
): ExperienceFactMatch[] {
  const jdText = normalize(jd);
  const jdEnglishTerms = new Set(jdText.match(/[a-z][a-z0-9+#.-]{1,}/g) || []);
  const jdChineseTerms = new Set(chineseTerms(jdText));

  return profile.experiences.flatMap((experience, experienceIndex) => {
    const ranked = experience.highlights
      .map((fact) => {
        const factText = normalize(fact);
        const englishTerms = [...new Set(factText.match(/[a-z][a-z0-9+#.-]{1,}/g) || [])];
        const chinese = chineseTerms(factText);
        const matchedTerms = [
          ...englishTerms.filter((term) => jdEnglishTerms.has(term) && term.length >= 2),
          ...chinese.filter((term) => jdChineseTerms.has(term)),
        ];
        const exactPhraseBonus = matchedTerms.some((term) => term.length >= 3 && jdText.includes(term)) ? 2 : 0;
        const score = matchedTerms.reduce((total, term) => total + (term.length >= 3 ? 2 : 1), 0) + exactPhraseBonus;
        return { fact: fact.trim(), score, matchedTerms: [...new Set(matchedTerms)] };
      })
      // A single generic two-character overlap (for example “用户” or
      // “工作”) is not enough evidence that a fact belongs in this resume.
      .filter((item) => item.fact && item.score >= 2)
      .sort((a, b) => b.score - a.score || a.fact.localeCompare(b.fact, 'zh-CN'))
      .slice(0, Math.max(0, limitPerExperience));

    return ranked.map((item) => ({
      experienceIndex,
      organization: experience.organization,
      title: experience.title,
      ...item,
    }));
  });
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[\u3000\s]+/g, ' ').trim();
}

function chineseTerms(value: string) {
  const terms = new Set<string>();
  for (const phrase of value.match(/[\u3400-\u9fff]{2,}/g) || []) {
    for (let size = 2; size <= Math.min(4, phrase.length); size += 1) {
      for (let index = 0; index <= phrase.length - size; index += 1) {
        const term = phrase.slice(index, index + size);
        if (!/^(负责|参与|进行|完成|具备|熟悉|通过|能够|以及|相关|岗位|工作|要求|经验|能力|优先|以上|团队|公司|项目)$/.test(term)) {
          terms.add(term);
        }
      }
    }
  }
  return [...terms];
}
