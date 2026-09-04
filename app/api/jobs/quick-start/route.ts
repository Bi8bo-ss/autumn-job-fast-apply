import { z } from 'zod';
import { requireApiUser } from '@/lib/server/auth';
import { db, id, now } from '@/lib/server/data';
import { extractJobMetadata, matchResumeVersion } from '@/lib/server/job-intake';
import { errorResponse, json, readJson } from '@/lib/server/http';

const schema = z.object({ jd: z.string().trim().min(30, '岗位描述至少需要 30 个字').max(40_000) });

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) return json({ error: parsed.error.issues[0]?.message || '请粘贴完整岗位描述。' }, { status: 400 });
    const jd = parsed.data.jd;
    const metadata = extractJobMetadata(jd);
    const matchedResume = await matchResumeVersion(user.userId, jd, metadata.language);
    const jobId = id('job');
    const timestamp = now();
    await db().prepare(`INSERT INTO jobs
      (id,user_id,company,role,location,jd,source_url,deadline,language,status,created_at,updated_at)
      VALUES (?,?,?,?,?,?,NULL,NULL,?,'wishlist',?,?)`)
      .bind(jobId, user.userId, metadata.company, metadata.role, metadata.location || null, jd, metadata.language, timestamp, timestamp).run();
    return json({ job: { id: jobId, ...metadata }, matchedResume }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
