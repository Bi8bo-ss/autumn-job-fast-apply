import { AppShell } from '@/components/app-shell';
import { ResumeManager } from '@/components/resume-manager';
import { requirePageUser } from '@/lib/server/auth';
import { listResumes, listResumeVersions } from '@/lib/server/data';
export const dynamic = 'force-dynamic';
export default async function ResumesPage() { const user = await requirePageUser('/resumes'); const [resumes, versions] = await Promise.all([listResumes(user.userId), listResumeVersions(user.userId)]); return <AppShell title="简历版本" eyebrow="RESUME LIBRARY"><ResumeManager resumes={resumes} versions={versions} /></AppShell>; }
