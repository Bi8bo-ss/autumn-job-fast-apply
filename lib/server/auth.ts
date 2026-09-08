import { getChatGPTUser, requireChatGPTUser } from '@/app/chatgpt-auth';
import { redirect } from 'next/navigation';
import { getRuntimeEnv } from '@/lib/server/runtime';

function canAccessPrivateWorkspace(user: { userId: string; email: string }) {
  if (process.env.NODE_ENV !== 'production') return true;
  const runtime = getRuntimeEnv();
  const ownerUserId = runtime.APP_OWNER_USER_ID?.trim();
  const ownerEmail = runtime.APP_OWNER_EMAIL?.trim().toLowerCase();
  return Boolean(
    (ownerUserId && user.userId === ownerUserId)
    || (ownerEmail && user.email.trim().toLowerCase() === ownerEmail),
  );
}

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
  if (!canAccessPrivateWorkspace(user)) {
    throw new Response(JSON.stringify({ error: '正式工作台仅向所有者开放，请访问产品演示。' }), {
      status: 403,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
  return user;
}

export async function requirePageUser(returnTo: string) {
  const user = await getCurrentUser();
  if (!user) return requireChatGPTUser(returnTo);
  if (!canAccessPrivateWorkspace(user)) redirect('/demo?notice=private');
  return user;
}
