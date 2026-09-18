import type { Profile, ResumeContent } from './product-types';

type MaterialValue = {
  value: string;
  source: string;
};

export type ApplicationPackResumeFields = {
  education: MaterialValue;
  experiences: MaterialValue;
  projects: MaterialValue;
  skills: MaterialValue;
};

/**
 * Application materials must mirror the selected resume. The profile is a
 * fallback fact store, not an alternate source that may expand or replace a
 * finalized resume section.
 */
export function buildApplicationPackResumeFields(
  profile: Profile,
  resume: ResumeContent | null,
  resumeSource: string,
): ApplicationPackResumeFields {
  if (resume) {
    return {
      education: material(resume.education.join('\n'), resumeSource),
      experiences: material(formatResumeEntries(resume.experiences), resumeSource),
      projects: material(formatResumeEntries(resume.projects), resumeSource),
      skills: material(resume.skills.join('\n'), resumeSource),
    };
  }

  return {
    education: material(formatProfileEducation(profile), '个人档案'),
    experiences: material(formatProfileEntries(profile.experiences), '个人档案'),
    projects: material(formatProfileEntries(profile.projects), '个人档案'),
    skills: material(profile.skills.join('，'), '个人档案'),
  };
}

export function formatResumeEntries(entries: ResumeContent['experiences']) {
  return entries.map((entry) =>
    `${entry.heading}${entry.meta ? `｜${entry.meta}` : ''}\n${entry.bullets.map((item) => `• ${item}`).join('\n')}`,
  ).join('\n\n');
}

function material(value: string, source: string): MaterialValue {
  return { value, source };
}

function formatProfileEntries(entries: Profile['experiences']) {
  return entries.map((entry) =>
    `${entry.organization}｜${entry.title}｜${entry.startDate}-${entry.endDate}\n${entry.highlights.map((item) => `• ${item}`).join('\n')}`,
  ).join('\n\n');
}

function formatProfileEducation(profile: Profile) {
  return profile.education.map((entry) =>
    `${entry.school}｜${entry.degree}｜${entry.major}｜${entry.startDate}-${entry.endDate}`,
  ).join('\n');
}
