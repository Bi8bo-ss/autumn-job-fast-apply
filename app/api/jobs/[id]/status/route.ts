import { z } from 'zod';
import { jobStatuses } from '@/lib/product-types';
import { requireApiUser } from '@/lib/server/auth';
import { db, now } from '@/lib/server/data';
import { errorResponse, json, readJson } from '@/lib/server/http';
const schema = z.object({ status: z.enum(jobStatuses) });
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const user = await requireApiUser(); const { id } = await params; const parsed = schema.safeParse(await readJson(request)); if (!parsed.success) return json({ error: '投递状态无效。' }, { status: 400 }); const result = await db().prepare('UPDATE jobs SET status = ?, updated_at = ? WHERE id = ? AND user_id = ?').bind(parsed.data.status, now(), id, user.userId).run(); if (!result.meta.changes) return json({ error: '岗位不存在。' }, { status: 404 }); return json({ ok: true, status: parsed.data.status }); } catch (error) { return errorResponse(error); } }
