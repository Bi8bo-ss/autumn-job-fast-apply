import { AppShell } from '@/components/app-shell';
import { ProfileEditor } from '@/components/profile-editor';
import { requirePageUser } from '@/lib/server/auth';
import { getProfile } from '@/lib/server/data';
export const dynamic = 'force-dynamic';
export default async function ProfilePage() {
  const user = await requirePageUser('/profile');
  const profile = await getProfile(user.userId);
  return (
    <AppShell title="个人档案" description="只维护真实信息，供简历与填写材料复用。">
      <ProfileEditor initial={profile} />
    </AppShell>
  );
}
