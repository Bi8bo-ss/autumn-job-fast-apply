import { ArrowRight, BriefcaseBusiness, CalendarClock, FileText, Workflow } from 'lucide-react';
import { AppLink } from '@/components/app-link';
import { AppShell } from '@/components/app-shell';
import { jobStatusLabels, jobStatuses, type JobStatus } from '@/lib/product-types';
import { requirePageUser } from '@/lib/server/auth';
import { listJobs, listResumes } from '@/lib/server/data';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await requirePageUser('/');
  const [jobs, resumes] = await Promise.all([listJobs(user.userId), listResumes(user.userId)]);
  const counts = Object.fromEntries(
    jobStatuses.map((status) => [status, jobs.filter((job) => job.status === status).length]),
  ) as Record<JobStatus, number>;
  const next = getNextAction(jobs.length, resumes.length, jobs[0]?.id);

  return (
    <AppShell
      title={user.fullName ? `${user.fullName}，今天从这里继续` : '今天从这里继续'}
      description="优先处理最接近投递的任务。"
      showNewJob
    >
      <div className="mx-auto max-w-[1280px] space-y-7">
        <section className="grid overflow-hidden rounded-xl border bg-white lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,.7fr)]">
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <span className="status-dot bg-primary" />
              建议先做
            </div>
            <h2 className="mt-4 max-w-2xl text-2xl font-semibold tracking-[-0.035em] sm:text-[30px]">{next.title}</h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-muted-foreground">{next.description}</p>
            <AppLink
              href={next.href}
              data-interactive="true"
              className="pressable mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-[#0f52d5]"
            >
              {next.action}
              <ArrowRight className="size-4" />
            </AppLink>
          </div>
          <div className="border-t bg-[#f8faff] p-6 lg:border-l lg:border-t-0">
            <p className="text-sm font-semibold">当前进度</p>
            <dl className="mt-5 space-y-4">
              <Stat label="岗位" value={jobs.length} icon={BriefcaseBusiness} />
              <Stat label="基础简历" value={resumes.length} icon={FileText} />
              <Stat label="面试中" value={counts.interview} icon={CalendarClock} />
              <Stat label="已获得 Offer" value={counts.offer} icon={Workflow} />
            </dl>
          </div>
        </section>

        <section className="workspace-panel overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-4 sm:px-6">
            <div>
              <h2 className="font-semibold">最近岗位</h2>
              <p className="mt-1 text-sm text-muted-foreground">从上次停下的位置继续。</p>
            </div>
            <AppLink href="/jobs" data-interactive="true" className="text-sm font-medium text-primary hover:underline">查看全部</AppLink>
          </div>
          {jobs.length ? (
            <div className="divide-y">
              {jobs.slice(0, 5).map((job) => (
                <AppLink
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  data-interactive="true"
                  className="interactive-row grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-6"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{job.company || '公司未识别'}</p>
                    <p className="mt-1 truncate text-sm text-muted-foreground">{job.role || '岗位未识别'}</p>
                  </div>
                  <p className={job.deadline ? 'text-sm text-muted-foreground' : 'text-sm text-orange-700'}>
                    {job.deadline ? `截止 ${job.deadline}` : '待补截止时间'}
                  </p>
                  <span className="inline-flex w-fit items-center gap-2 rounded-md bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-[#465166]">
                    <span className="status-dot bg-primary" />
                    {jobStatusLabels[job.status as JobStatus] || job.status}
                  </span>
                </AppLink>
              ))}
            </div>
          ) : (
            <div className="px-6 py-12 text-center">
              <FileText className="mx-auto size-7 text-slate-400" />
              <p className="mt-3 font-medium">还没有岗位</p>
              <p className="mt-1 text-sm text-muted-foreground">粘贴第一份 JD，建立你的投递工作流。</p>
            </div>
          )}
        </section>

        <section className="workspace-panel overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-4 sm:px-6">
            <h2 className="font-semibold">投递阶段</h2>
            <AppLink href="/pipeline" data-interactive="true" className="text-sm font-medium text-primary hover:underline">打开看板</AppLink>
          </div>
          <div className="grid grid-cols-3 divide-x sm:grid-cols-6">
            {jobStatuses.map((status) => (
              <div key={status} className="px-3 py-4 text-center">
                <p className="text-xl font-semibold tabular-nums">{counts[status]}</p>
                <p className="mt-1 text-xs text-muted-foreground">{jobStatusLabels[status]}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function getNextAction(jobCount: number, resumeCount: number, latestJobId?: string) {
  if (!resumeCount) return {
    title: '先导入一份基础简历',
    description: '系统会把它作为事实来源，为每个岗位生成独立版本。',
    href: '/resumes',
    action: '导入基础简历',
  };
  if (!jobCount) return {
    title: '粘贴第一份岗位 JD',
    description: '系统会识别公司和岗位，并自动匹配最合适的基础简历。',
    href: '/jobs/new',
    action: '新建岗位',
  };
  return {
    title: '继续处理最近的岗位',
    description: '检查岗位匹配，逐条确认简历修改，完成后即可导出投递版本。',
    href: `/jobs/${latestJobId}?tab=tune`,
    action: '继续简历微调',
  };
}

function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: typeof BriefcaseBusiness }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-9 place-items-center rounded-lg border bg-white text-[#58657a]"><Icon className="size-4" /></span>
      <dt className="flex-1 text-sm text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
