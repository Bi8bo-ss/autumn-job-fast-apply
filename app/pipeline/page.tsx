import { AppShell } from '@/components/app-shell';
import { PipelineBoard } from '@/components/pipeline-board';
import { requirePageUser } from '@/lib/server/auth';
import { listJobs } from '@/lib/server/data';
export const dynamic='force-dynamic';
export default async function PipelinePage() {
  const user = await requirePageUser('/pipeline');
  const jobs = await listJobs(user.userId);
  return (
    <AppShell title="投递看板" description="按阶段安排每一份申请的下一步。" showNewJob>
      <PipelineBoard initial={jobs} />
    </AppShell>
  );
}
