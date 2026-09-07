import { AppShell } from '@/components/app-shell';
import { JobsExplorer } from '@/components/jobs-explorer';
import { requirePageUser } from '@/lib/server/auth';
import { listJobs } from '@/lib/server/data';
export const dynamic = 'force-dynamic';
export default async function JobsPage() {
  const user = await requirePageUser('/jobs');
  const jobs = await listJobs(user.userId);
  return (
    <AppShell title="岗位" description="搜索、筛选并继续每一份申请。" showNewJob>
      <div className="mx-auto max-w-[1280px]"><JobsExplorer jobs={jobs} /></div>
    </AppShell>
  );
}
