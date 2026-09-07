import { AppShell } from '@/components/app-shell';
import { AiSettingsPanel } from '@/components/ai-settings-panel';
import { requirePageUser } from '@/lib/server/auth';
import { getProfile } from '@/lib/server/data';
import { getRuntimeEnv } from '@/lib/server/runtime';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const user = await requirePageUser('/settings');
  const profile = await getProfile(user.userId);
  const runtime = getRuntimeEnv();
  return (
    <AppShell title="AI 设置" description="控制生成偏好、隐私边界与连接状态。">
      <AiSettingsPanel
        initial={profile.aiSettings}
        connection={{
          configured: Boolean(runtime.OPENAI_API_KEY),
          model: runtime.OPENAI_MODEL || 'gpt-5.6-luna',
        }}
      />
    </AppShell>
  );
}
