import { aiSettingsSchema } from '@/lib/product-types';
import { requireApiUser } from '@/lib/server/auth';
import { db, getProfile, id, now } from '@/lib/server/data';
import { errorResponse, json, readJson } from '@/lib/server/http';
import { getOpenAiModels, getRuntimeEnv } from '@/lib/server/runtime';

export async function GET() {
  try {
    const user = await requireApiUser();
    const profile = await getProfile(user.userId);
    const runtime = getRuntimeEnv();
    const models = getOpenAiModels();
    return json({
      settings: profile.aiSettings,
      connection: {
        configured: Boolean(runtime.OPENAI_API_KEY),
        model: models.quality,
        fastModel: models.fast,
        api: 'OpenAI Responses API',
        store: false,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireApiUser();
    const parsed = aiSettingsSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return json({ error: 'AI 设置格式有误。' }, { status: 400 });
    }
    const profile = await getProfile(user.userId);
    const updated = { ...profile, aiSettings: parsed.data };
    const timestamp = now();
    await db()
      .prepare(`INSERT INTO profiles (id,user_id,content_json,completeness,created_at,updated_at)
        VALUES (?,?,?,0,?,?)
        ON CONFLICT(user_id) DO UPDATE SET content_json=excluded.content_json, updated_at=excluded.updated_at`)
      .bind(id('profile'), user.userId, JSON.stringify(updated), timestamp, timestamp)
      .run();
    return json({ ok: true, settings: parsed.data });
  } catch (error) {
    return errorResponse(error);
  }
}
