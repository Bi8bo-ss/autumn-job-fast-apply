import { env } from 'cloudflare:workers';
import type { Profile, ResumeContent } from '@/lib/product-types';
import { emptyProfile, profileSchema } from '@/lib/product-types';
import { normalizeResumeContent, parseResumeText, resumeContentToText } from '@/lib/resume-parser';

export type JobRecord = {
  id: string;
  company: string;
  role: string;
  location: string | null;
  jd: string;
  sourceUrl: string | null;
  deadline: string | null;
  language: 'zh' | 'en';
  status: string;
  analysisJson: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ResumeRecord = {
  id: string;
  name: string;
  language: 'zh' | 'en';
  currentVersionId: string | null;
  sourceFileId: string | null;
  createdAt: string;
  updatedAt: string;
};

export function db() {
  if (!env.DB) throw new Error('数据库暂不可用，请稍后重试。');
  return env.DB;
}

export function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function now() {
  return new Date().toISOString();
}

export async function getProfile(userId: string): Promise<Profile> {
  const row = await db()
    .prepare('SELECT content_json FROM profiles WHERE user_id = ? LIMIT 1')
    .bind(userId)
    .first<{ content_json: string }>();
  if (!row) return emptyProfile;
  try {
    const parsed = profileSchema.safeParse(JSON.parse(row.content_json));
    return parsed.success ? parsed.data : emptyProfile;
  } catch {
    return emptyProfile;
  }
}

export async function listJobs(userId: string) {
  const result = await db()
    .prepare(`SELECT id, company, role, location, jd, source_url AS sourceUrl,
      deadline, language, status, analysis_json AS analysisJson,
      created_at AS createdAt, updated_at AS updatedAt
      FROM jobs WHERE user_id = ? ORDER BY updated_at DESC`)
    .bind(userId)
    .all<JobRecord>();
  return result.results;
}

export async function getJob(userId: string, jobId: string) {
  return db()
    .prepare(`SELECT id, company, role, location, jd, source_url AS sourceUrl,
      deadline, language, status, analysis_json AS analysisJson,
      created_at AS createdAt, updated_at AS updatedAt
      FROM jobs WHERE user_id = ? AND id = ? LIMIT 1`)
    .bind(userId, jobId)
    .first<JobRecord>();
}

export async function listResumes(userId: string) {
  const result = await db()
    .prepare(`SELECT id, name, language, current_version_id AS currentVersionId, source_file_id AS sourceFileId,
      created_at AS createdAt, updated_at AS updatedAt
      FROM resumes WHERE user_id = ? AND is_base = 1 ORDER BY updated_at DESC`)
    .bind(userId)
    .all<ResumeRecord>();
  return result.results;
}

export async function listResumeVersions(userId: string) {
  const result = await db().prepare(`SELECT rv.id, rv.resume_id AS resumeId,
    rv.job_id AS jobId, rv.parent_version_id AS parentVersionId,
    rv.version_number AS versionNumber, rv.created_at AS createdAt,
    r.name AS resumeName, r.language, j.company, j.role
    FROM resume_versions rv JOIN resumes r ON r.id = rv.resume_id
    LEFT JOIN jobs j ON j.id = rv.job_id
    WHERE rv.user_id = ? ORDER BY rv.created_at DESC`).bind(userId).all<{
      id:string; resumeId:string; jobId:string|null; parentVersionId:string|null;
      versionNumber:number; createdAt:string; resumeName:string; language:'zh'|'en'; company:string|null; role:string|null;
    }>();
  return result.results;
}

export async function getResumeVersion(userId: string, versionId: string) {
  return db()
    .prepare(`SELECT rv.id, rv.resume_id AS resumeId, rv.job_id AS jobId,
      rv.parent_version_id AS parentVersionId, rv.version_number AS versionNumber,
      rv.content_json AS contentJson, rv.source_text AS sourceText,
      rv.created_at AS createdAt, r.name AS resumeName, r.language
      FROM resume_versions rv JOIN resumes r ON r.id = rv.resume_id
      WHERE rv.user_id = ? AND rv.id = ? LIMIT 1`)
    .bind(userId, versionId)
    .first<{
      id: string;
      resumeId: string;
      jobId: string | null;
      parentVersionId: string | null;
      versionNumber: number;
      contentJson: string;
      sourceText: string;
      createdAt: string;
      resumeName: string;
      language: 'zh' | 'en';
    }>();
}

export async function getOriginalResumeVersion(userId: string, requestedVersionId: string) {
  const requested = await getResumeVersion(userId, requestedVersionId);
  if (!requested) return null;

  return db()
    .prepare(`SELECT rv.id, rv.resume_id AS resumeId, rv.job_id AS jobId,
      rv.parent_version_id AS parentVersionId, rv.version_number AS versionNumber,
      rv.content_json AS contentJson, rv.source_text AS sourceText,
      rv.created_at AS createdAt, r.name AS resumeName, r.language
      FROM resume_versions rv JOIN resumes r ON r.id = rv.resume_id
      WHERE rv.user_id = ? AND rv.resume_id = ?
        AND rv.job_id IS NULL AND rv.parent_version_id IS NULL
      ORDER BY rv.version_number ASC, rv.created_at ASC LIMIT 1`)
    .bind(userId, requested.resumeId)
    .first<typeof requested>();
}

export function contentFromText(text: string, language: 'zh' | 'en'): ResumeContent {
  return normalizeResumeContent(parseResumeText(text, language), text);
}

export function textFromContent(content: ResumeContent) {
  return resumeContentToText(content);
}

export async function getJobWorkspace(userId: string, jobId: string) {
  const [job, resumes, versions, run, pack] = await Promise.all([
    getJob(userId, jobId),
    listResumes(userId),
    db().prepare(`SELECT rv.id, rv.resume_id AS resumeId, rv.job_id AS jobId,
      rv.parent_version_id AS parentVersionId, rv.version_number AS versionNumber,
      rv.content_json AS contentJson, rv.source_text AS sourceText, rv.created_at AS createdAt,
      r.name AS resumeName, r.language FROM resume_versions rv JOIN resumes r ON r.id=rv.resume_id
      WHERE rv.user_id=? AND (rv.job_id=? OR (rv.job_id IS NULL AND r.is_base=1)) ORDER BY rv.created_at DESC`).bind(userId, jobId).all(),
    db().prepare(`SELECT id,resume_version_id AS resumeVersionId,status,analysis_json AS analysisJson,created_at AS createdAt FROM tune_runs WHERE user_id=? AND job_id=? ORDER BY created_at DESC LIMIT 1`).bind(userId,jobId).first(),
    db().prepare(`SELECT id,resume_version_id AS resumeVersionId,content_json AS contentJson,created_at AS createdAt,updated_at AS updatedAt FROM application_packs WHERE user_id=? AND job_id=? ORDER BY updated_at DESC LIMIT 1`).bind(userId,jobId).first(),
  ]);
  let suggestions: unknown[] = [];
  let answers: unknown[] = [];
  if (run && typeof run === 'object' && 'id' in run) {
    const result = await db().prepare(`SELECT id,section_key AS sectionKey,original_text AS originalText,proposed_text AS proposedText,edited_text AS editedText,rationale,matched_requirement AS matchedRequirement,needs_user_input AS needsUserInput,state,sort_order AS sortOrder FROM tune_suggestions WHERE user_id=? AND run_id=? ORDER BY sort_order`).bind(userId,String(run.id)).all(); suggestions = result.results;
  }
  if (pack && typeof pack === 'object' && 'id' in pack) {
    const result = await db().prepare(`SELECT id,question,answer,char_limit AS charLimit,created_at AS createdAt FROM custom_answers WHERE user_id=? AND pack_id=? ORDER BY created_at DESC`).bind(userId,String(pack.id)).all(); answers = result.results;
  }
  return { job, resumes, versions: versions.results, run, suggestions, pack, answers };
}
