import { AppShell } from '@/components/app-shell';
import { JobForm } from '@/components/job-form';
import { requirePageUser } from '@/lib/server/auth';
import { listResumes } from '@/lib/server/data';
export const dynamic = 'force-dynamic';
export default async function NewJobPage() { const user = await requirePageUser('/jobs/new'); const resumes = await listResumes(user.userId); return <AppShell title="新建岗位" eyebrow="NEW JOB"><JobForm resumes={resumes} /></AppShell>; }
