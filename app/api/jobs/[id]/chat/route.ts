import { jobChatInputSchema, resumeContentSchema } from '@/lib/product-types';
import { normalizeResumeContent } from '@/lib/resume-parser';
import { chatWithJobAi } from '@/lib/server/ai';
import { requireApiUser } from '@/lib/server/auth';
import { getJob, getOriginalResumeVersion, getProfile } from '@/lib/server/data';
import { errorResponse, json, readJson } from '@/lib/server/http';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const parsed = jobChatInputSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return json({ error: parsed.error.issues[0]?.message || '对话内容无效。' }, { status: 400 });
    }
    const [job, version, profile] = await Promise.all([
      getJob(user.userId, id),
      getOriginalResumeVersion(user.userId, parsed.data.resumeVersionId),
      getProfile(user.userId),
    ]);
    if (!job || !version) return json({ error: '岗位或原始基础简历不存在。' }, { status: 404 });
    const raw = resumeContentSchema.parse(JSON.parse(version.contentJson));
    const content = normalizeResumeContent(raw, version.sourceText);
    const result = await chatWithJobAi({
      jd: job.jd,
      content,
      profile,
      message: parsed.data.message,
      history: parsed.data.history,
    });
    return json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
