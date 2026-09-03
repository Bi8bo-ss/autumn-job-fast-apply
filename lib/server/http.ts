export function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

export function errorResponse(error: unknown) {
  if (error instanceof Response) return error;
  const message =
    error instanceof Error ? error.message : '发生未知错误，请稍后重试。';
  console.error(error);
  return json({ error: message }, { status: 500 });
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Response(JSON.stringify({ error: '请求内容不是有效 JSON。' }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
}
