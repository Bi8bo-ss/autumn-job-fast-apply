import { buildApplicationPack } from '@/lib/server/application-pack';
import { requireApiUser } from '@/lib/server/auth';
import { errorResponse, json } from '@/lib/server/http';

export async function POST(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const result = await buildApplicationPack(user.userId, id);

    if (!result) {
      return json({ error: '岗位不存在。' }, { status: 404 });
    }

    return json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
