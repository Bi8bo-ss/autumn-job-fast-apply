import type { Profile, ResumeContent } from './product-types';

// Extraction is deliberately literal and ambiguous contacts stay empty. A
// resume title is not necessarily a person's name, and no protected identity,
// nationality, age or work-authorization value is inferred from a resume.
export function resumeContactFacts(resume: ResumeContent | null | undefined, sourceText: string) {
  const unique = (values: string[]) => [...new Set(values)];
  const emails = unique(sourceText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []);
  const phones = unique(sourceText.match(/(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)/g) || []);
  const firstLine = sourceText.split(/\r?\n/).map(line => line.trim()).find(Boolean) || '';
  const explicitName = sourceText.match(/(?:^|\n)\s*(?:姓名|full name)\s*[：:]\s*([^\n|｜，,;；]{2,60})/i)?.[1]?.split(/\s*(?:邮箱|手机|电话|email|phone)\s*[：:]/i)[0]?.trim() || '';
  const headline = resume?.headline?.trim() || '';
  const shortName = /^[\u3400-\u9fff]{2,4}$/.test(headline) && !/简历|个人|分析|工程|管理|设计|开发|求职|应聘/.test(headline);
  return { name: explicitName || (shortName && firstLine === headline ? headline : ''), email: emails.length === 1 ? emails[0] : '', phone: phones.length === 1 ? phones[0] : '' };
}

export function fillMissingResumeContacts(profile: Profile, resume: ResumeContent | null | undefined, sourceText: string) {
  const extracted = resumeContactFacts(resume, sourceText);
  const identity = { ...profile.identity };
  const sources: Record<string, string> = {};
  for (const key of ['name', 'email', 'phone'] as const) if (!identity[key] && extracted[key]) {
    identity[key] = extracted[key]; sources[`identity.${key}`] = '原版简历中的明确文字';
  }
  return { profile: { ...profile, identity }, sources };
}
