import {
  resumeContentSchema,
  type ApplicationPackContent,
  type MaterialGroup,
  type Profile,
  type ResumeContent,
} from '@/lib/product-types';
import { normalizeResumeContent } from '@/lib/resume-parser';
import { generateApplicationNarrativesWithAi } from '@/lib/server/ai';
import { db, getJob, getProfile, id as makeId, now } from '@/lib/server/data';

type ResumeVersionRow = {
  id: string;
  jobId: string | null;
  contentJson: string;
  sourceText: string;
};

export async function buildApplicationPack(userId: string, jobId: string) {
  const [job, profile, version] = await Promise.all([
    getJob(userId, jobId),
    getProfile(userId),
    db().prepare(`SELECT id,job_id AS jobId,content_json AS contentJson,source_text AS sourceText
      FROM resume_versions WHERE user_id=? AND (job_id=? OR job_id IS NULL)
      ORDER BY CASE WHEN job_id=? THEN 0 ELSE 1 END, created_at DESC LIMIT 1`)
      .bind(userId, jobId, jobId).first<ResumeVersionRow>(),
  ]);
  if (!job) return null;

  const resume = parseResume(version);
  const resumeSource = version?.jobId ? '岗位简历' : '基础简历';
  let selfEvaluation = '';
  let selfIntroduction = '';
  let motivation = '';
  try {
    const generated = await generateApplicationNarrativesWithAi({
      profile,
      resume,
      jd: job.jd,
      language: job.language,
    });
    selfEvaluation = generated.selfEvaluation;
    selfIntroduction = generated.selfIntroduction;
    motivation = generated.motivation;
  } catch {
    // Resume-derived standard fields remain available when AI is temporarily unavailable.
  }

  const sourceText = version?.sourceText || '';
  const profileEducation = formatProfileEducation(profile);
  const profileExperiences = formatProfileEntries(profile.experiences);
  const profileProjects = formatProfileEntries(profile.projects);
  const resumeExperiences = formatResumeEntries(resume?.experiences || []);
  const resumeProjects = formatResumeEntries(resume?.projects || []);
  const summary = job.language === 'zh' ? profile.summaries.zh : profile.summaries.en;
  const resumeSummary = resume?.summary && !containsContact(resume.summary) ? resume.summary : '';
  const field = (id: string, label: string, value: string, source: string) => {
    const cleaned = value.trim();
    return { id, label, value: cleaned, source, missing: !cleaned };
  };
  const prefer = (profileValue: string, resumeValue: string) => ({
    value: profileValue || resumeValue,
    source: profileValue ? '个人档案' : resumeSource,
  });

  const name = prefer(
    profile.identity.name,
    resume?.headline === '个人简历' ? '' : resume?.headline || '',
  );
  const email = prefer(
    profile.identity.email,
    sourceText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '',
  );
  const phone = prefer(
    profile.identity.phone,
    sourceText.match(/(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)/)?.[0] || '',
  );
  const education = prefer(profileEducation, resume?.education.join('\n') || '');
  const experiences = prefer(profileExperiences, resumeExperiences);
  const projects = prefer(profileProjects, resumeProjects);
  const skills = prefer(profile.skills.join('，'), resume?.skills.join('\n') || '');
  const fallbackSelfEvaluation = prefer(summary, resumeSummary);
  const selfEvaluationSource = selfEvaluation ? `AI 基于${resume ? resumeSource : '事实档案'}与 JD 生成` : fallbackSelfEvaluation.source;

  const groups: MaterialGroup[] = [
    {
      id: 'identity',
      title: '个人信息',
      fields: [
        field('name', '姓名', name.value, name.source),
        field('email', '邮箱', email.value, email.source),
        field('phone', '手机', phone.value, phone.source),
        field('location', '所在地', profile.identity.location, '个人档案'),
        field('idNumber', '身份证号', profile.identity.idNumber, '个人档案'),
      ],
    },
    {
      id: 'education',
      title: '教育经历',
      fields: [field('education', '教育经历', education.value, education.source)],
    },
    {
      id: 'experience',
      title: '经历与项目',
      fields: [
        field('experiences', '实习/工作经历', experiences.value, experiences.source),
        field('projects', '项目经历', projects.value, projects.source),
      ],
    },
    {
      id: 'skills',
      title: '技能与证书',
      fields: [
        field('skills', '技能', skills.value, skills.source),
        field('certificates', '证书', profile.certificates.join('，'), '个人档案'),
        field('languages', '语言', profile.languages.join('，'), '个人档案'),
        field('extras', '其他信息', resume?.extras.join('\n') || '', resumeSource),
      ],
    },
    {
      id: 'preferences',
      title: '求职偏好',
      fields: [
        field(
          'roles',
          '目标岗位',
          profile.preferences.desiredRoles.join('，') || job.role,
          profile.preferences.desiredRoles.length ? '个人档案' : '岗位信息',
        ),
        field(
          'locations',
          '目标城市',
          profile.preferences.desiredLocations.join('，') || job.location || '',
          profile.preferences.desiredLocations.length ? '个人档案' : '岗位信息',
        ),
        field('availability', '到岗时间', profile.preferences.availability, '个人档案'),
      ],
    },
    {
      id: 'narratives',
      title: '自我评价、自我介绍与岗位动机',
      fields: [
        field('selfEvaluation', '自我评价', selfEvaluation || fallbackSelfEvaluation.value, selfEvaluationSource),
        field(
          'selfIntroduction',
          '个人自我介绍',
          selfIntroduction,
          `AI 基于${resume ? resumeSource : '事实档案'}与 JD 生成`,
        ),
        field(
          'motivation',
          '岗位动机',
          motivation,
          `AI 基于${resume ? resumeSource : '事实档案'}与 JD 生成`,
        ),
      ],
    },
  ];

  for (const custom of profile.customFields) {
    let group = groups.find((item) => item.title === custom.group);
    if (!group) {
      group = { id: `custom-${custom.group}`, title: custom.group, fields: [] };
      groups.push(group);
    }
    group.fields.push(field(custom.id, custom.label, custom.value, '自定义字段'));
  }

  const missingFields = groups.flatMap((group) =>
    group.fields.filter((item) => item.missing).map((item) => `${group.title} / ${item.label}`),
  );
  const content: ApplicationPackContent = {
    groups,
    selfEvaluation: selfEvaluation || fallbackSelfEvaluation.value,
    selfIntroduction,
    motivation,
    missingFields,
  };
  const timestamp = now();
  const existing = await db().prepare(
    'SELECT id FROM application_packs WHERE user_id=? AND job_id=? ORDER BY updated_at DESC LIMIT 1',
  ).bind(userId, jobId).first<{ id: string }>();
  const packId = existing?.id || makeId('pack');
  if (existing) {
    await db().prepare(
      'UPDATE application_packs SET resume_version_id=?,content_json=?,updated_at=? WHERE id=? AND user_id=?',
    ).bind(version?.id || null, JSON.stringify(content), timestamp, packId, userId).run();
  } else {
    await db().prepare(
      'INSERT INTO application_packs (id,user_id,job_id,resume_version_id,content_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
    ).bind(packId, userId, jobId, version?.id || null, JSON.stringify(content), timestamp, timestamp).run();
  }
  return { pack: { id: packId, content, resumeVersionId: version?.id || null } };
}

function parseResume(version: ResumeVersionRow | null): ResumeContent | null {
  if (!version) return null;
  try {
    const parsed = resumeContentSchema.parse(JSON.parse(version.contentJson));
    return normalizeResumeContent(parsed, version.sourceText);
  } catch {
    return null;
  }
}

function formatResumeEntries(entries: ResumeContent['experiences']) {
  return entries.map((entry) =>
    `${entry.heading}${entry.meta ? `｜${entry.meta}` : ''}\n${entry.bullets.map((item) => `• ${item}`).join('\n')}`,
  ).join('\n\n');
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

function containsContact(value: string) {
  return /@|(?:\+?86[-\s]?)?1[3-9]\d{9}|邮箱|手机|电话|email|tel\.?/i.test(value);
}
