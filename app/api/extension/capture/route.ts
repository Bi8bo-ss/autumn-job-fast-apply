import { z } from 'zod';
import { extractCapturedJobWithAi } from '@/lib/server/ai';
import { requireApiUser } from '@/lib/server/auth';
import { getProfile } from '@/lib/server/data';
import { errorResponse, json, readJson } from '@/lib/server/http';

const inputSchema = z.object({ text: z.string().max(40_000), title: z.string().max(500), url: z.url().max(3000), screenshot: z.string().max(4_000_000).regex(/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+$/).optional() });
export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const parsed = inputSchema.safeParse(await readJson(request));
    if (!parsed.success) return json({ error: '页面采集内容无效或图片过大。' }, { status: 400 });
    const profile = await getProfile(user.userId);
    const result = await extractCapturedJobWithAi(parsed.data, profile.aiSettings);
    return json({ ...result, sourceUrl: parsed.data.url, language: /[\u4e00-\u9fff]/.test(result.jd) ? 'zh' : 'en' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}
