import { z } from 'zod';
import { analyzeJobWithAi } from '@/lib/server/ai';
import { requireApiUser } from '@/lib/server/auth';
import { db, getJob, getOriginalResumeVersion, getProfile, now } from '@/lib/server/data';
import { errorResponse, json, readJson } from '@/lib/server/http';
import { resumeContentSchema } from '@/lib/product-types';
import { normalizeResumeContent, resumeContentToText } from '@/lib/resume-parser';
const schema=z.object({resumeVersionId:z.string().min(1)});
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{const user=await requireApiUser();const {id}=await params;const parsed=schema.safeParse(await readJson(request));if(!parsed.success)return json({error:'请选择原始基础简历。'},{status:400});const [job,version,profile]=await Promise.all([getJob(user.userId,id),getOriginalResumeVersion(user.userId,parsed.data.resumeVersionId),getProfile(user.userId)]);if(!job||!version)return json({error:'岗位或原始简历不存在。'},{status:404});const raw=resumeContentSchema.parse(JSON.parse(version.contentJson));const content=normalizeResumeContent(raw,version.sourceText);const analysis=await analyzeJobWithAi({jd:job.jd,resumeText:resumeContentToText(content),settings:profile.aiSettings});await db().prepare('UPDATE jobs SET analysis_json=?,updated_at=? WHERE id=? AND user_id=?').bind(JSON.stringify(analysis),now(),id,user.userId).run();return json({analysis,baseResumeVersionId:version.id});}catch(error){return errorResponse(error);}}
