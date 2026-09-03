import { jobInputSchema } from '@/lib/product-types';
import { requireApiUser } from '@/lib/server/auth';
import { db, id, listJobs, now } from '@/lib/server/data';
import { errorResponse, json, readJson } from '@/lib/server/http';

export async function GET() { try { const user = await requireApiUser(); return json({ jobs: await listJobs(user.userId) }); } catch (error) { return errorResponse(error); } }
export async function POST(request: Request) { try { const user = await requireApiUser(); const parsed = jobInputSchema.safeParse(await readJson(request)); if (!parsed.success) return json({ error: parsed.error.issues[0]?.message || '请检查岗位信息。' }, { status: 400 }); const jobId = id('job'); const timestamp = now(); const data = parsed.data; await db().prepare(`INSERT INTO jobs (id,user_id,company,role,location,jd,source_url,deadline,language,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,'wishlist',?,?)`).bind(jobId,user.userId,data.company,data.role,data.location || null,data.jd,data.sourceUrl || null,data.deadline || null,data.language,timestamp,timestamp).run(); return json({ job: { id: jobId } }, { status: 201 }); } catch (error) { return errorResponse(error); } }
