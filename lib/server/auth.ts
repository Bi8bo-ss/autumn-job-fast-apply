import { getChatGPTUser, requireChatGPTUser } from '@/app/chatgpt-auth';

export async function getCurrentUser() {
  const user = await getChatGPTUser();
  if (user) return user;

  if (process.env.NODE_ENV !== 'production') {
    return {
      userId: 'local-development-user',
      displayName: '本地用户',
      email: 'seedy@sites.test',
      fullName: '本地用户',
    };
  }

  return null;
}

export async function requireApiUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Response(JSON.stringify({ error: '请先登录后继续。' }), {
      status: 401,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
  return user;
}

export async function requirePageUser(returnTo: string) {
  const user = await getCurrentUser();
  if (user) return user;
  return requireChatGPTUser(returnTo);
}
