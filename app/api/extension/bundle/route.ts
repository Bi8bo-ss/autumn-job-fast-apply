import { buildExtensionCatalog } from '@/lib/extension-catalog';
import { applicationPackFromJson } from '@/lib/server/extension-data';
import { resumeContentSchema } from '@/lib/product-types';
import { normalizeResumeContent } from '@/lib/resume-parser';
import { fillMissingResumeContacts } from '@/lib/resume-form-facts';
import { requireApiUser } from '@/lib/server/auth';
import { db, getJob, getProfile, getResumeVersion, listJobs } from '@/lib/server/data';
import { errorResponse, json } from '@/lib/server/http';

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const jobId = new URL(request.url).searchParams.get('jobId') || '';
    const [profile, jobs, job] = await Promise.all([getProfile(user.userId), listJobs(user.userId), jobId ? getJob(user.userId, jobId) : null]);
    if (jobId && !job) return json({ error: '岗位不存在。' }, { status: 404 });
    const packRow = jobId ? await db().prepare('SELECT id,content_json AS contentJson,resume_version_id AS resumeVersionId FROM application_packs WHERE user_id=? AND job_id=? ORDER BY updated_at DESC LIMIT 1').bind(user.userId, jobId).first<{ id: string; contentJson: string; resumeVersionId: string | null }>() : null;
    let versionRow = await db().prepare(jobId
      ? 'SELECT id FROM resume_versions WHERE user_id=? AND job_id=? ORDER BY created_at DESC LIMIT 1'
      : 'SELECT id FROM resume_versions WHERE user_id=? AND job_id IS NULL AND parent_version_id IS NULL ORDER BY created_at DESC LIMIT 1')
      .bind(...(jobId ? [user.userId, jobId] : [user.userId])).first<{ id: string }>();
    if (!versionRow && jobId) versionRow = await db().prepare('SELECT resume_version_id AS id FROM tune_runs WHERE user_id=? AND job_id=? ORDER BY created_at DESC LIMIT 1').bind(user.userId, jobId).first<{ id: string }>();
    // A newly captured job may not have a tune run yet. Keep the latest original
    // resume's complete skills instead of dropping them when a job is selected.
    if (!versionRow && jobId) versionRow = await db().prepare('SELECT id FROM resume_versions WHERE user_id=? AND job_id IS NULL AND parent_version_id IS NULL ORDER BY created_at DESC LIMIT 1').bind(user.userId).first<{ id: string }>();
    const version = versionRow ? await getResumeVersion(user.userId, versionRow.id) : null;
    const parsed = version ? resumeContentSchema.safeParse(JSON.parse(version.contentJson)) : null;
    const resume = parsed?.success ? normalizeResumeContent(parsed.data, version?.sourceText || '') : null;
    const contactFallback = fillMissingResumeContacts(profile, resume, version?.sourceText || '');
    const facts = buildExtensionCatalog(contactFallback.profile, resume, applicationPackFromJson(packRow?.contentJson), Boolean(jobId && version?.jobId === jobId));
    for (const fact of facts) if (contactFallback.sources[fact.key]) fact.source = contactFallback.sources[fact.key];
    if (packRow) {
      const answers = await db().prepare('SELECT id,question,answer FROM custom_answers WHERE user_id=? AND pack_id=? ORDER BY updated_at DESC LIMIT 100').bind(user.userId, packRow.id).all<{ id: string; question: string; answer: string }>();
      for (const answer of answers.results) if (answer.answer.trim()) facts.push({ key: `answer.${answer.id}`, label: answer.question, aliases: [answer.question], value: answer.answer, section: 'custom', index: 0, source: '已保存岗位问答' });
    }
    const missingSections = [!facts.some(fact => fact.key === 'identity.name') && '姓名', !profile.education.length && '结构化教育经历', !profile.experiences.length && '结构化工作经历'].filter(Boolean);
    return json({ facts, missingSections, resumeName: version?.resumeName || '', jobs: jobs.map(({ id, company, role }) => ({ id, company, role })), selectedJob: job ? { id: job.id, company: job.company, role: job.role } : null, updatedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}
