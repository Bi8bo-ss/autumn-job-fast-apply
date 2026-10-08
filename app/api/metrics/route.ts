import { requireApiUser } from '@/lib/server/auth';
import { db } from '@/lib/server/data';
import { errorResponse, json } from '@/lib/server/http';
import { loadMetrics } from '@/lib/server/metrics';

/** 当前登录用户的使用统计（仅工作台所有者可访问）。 */
export async function GET() {
  try {
    const user = await requireApiUser();
    return json({ generatedAt: new Date().toISOString(), metrics: await loadMetrics(db(), user.userId) });
  } catch (error) {
    return errorResponse(error);
  }
}
