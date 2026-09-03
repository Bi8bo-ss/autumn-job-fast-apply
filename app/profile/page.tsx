import { AppShell } from '@/components/app-shell';
import { ProfileEditor } from '@/components/profile-editor';
import { requirePageUser } from '@/lib/server/auth';
import { getProfile } from '@/lib/server/data';
export const dynamic = 'force-dynamic';
export default async function ProfilePage() { const user = await requirePageUser('/profile'); const profile = await getProfile(user.userId); return <AppShell title="个人事实档案" eyebrow="MASTER PROFILE"><ProfileEditor initial={profile} /></AppShell>; }
