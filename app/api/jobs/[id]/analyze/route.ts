import { z } from 'zod';
import { analyzeJobWithAi } from '@/lib/server/ai';
import { requireApiUser } from '@/lib/server/auth';
import { db, getJob, getResumeVersion, now } from '@/lib/server/data';
import { errorResponse, json, readJson } from '@/lib/server/http';
const schema=z.object({resumeVersionId:z.string().min(1)});
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{const user=await requireApiUser();const {id}=await params;const parsed=schema.safeParse(await readJson(request));if(!parsed.success)return json({error:'请选择基础简历。'},{status:400});const [job,version]=await Promise.all([getJob(user.userId,id),getResumeVersion(user.userId,parsed.data.resumeVersionId)]);if(!job||!version)return json({error:'岗位或简历不存在。'},{status:404});const analysis=await analyzeJobWithAi({jd:job.jd,resumeText:version.sourceText});await db().prepare('UPDATE jobs SET analysis_json=?,updated_at=? WHERE id=? AND user_id=?').bind(JSON.stringify(analysis),now(),id,user.userId).run();return json({analysis});}catch(error){return errorResponse(error);}}
