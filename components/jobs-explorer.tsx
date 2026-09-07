'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, BriefcaseBusiness, Search } from 'lucide-react';
import { AppLink } from '@/components/app-link';
import { Input } from '@/components/ui/input';
import { jobStatusLabels, jobStatuses, type JobStatus } from '@/lib/product-types';
import type { JobRecord } from '@/lib/server/data';

type SortMode = 'updated' | 'deadline' | 'company';

export function JobsExplorer({ jobs }: { jobs: JobRecord[] }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | JobStatus>('all');
  const [sort, setSort] = useState<SortMode>('updated');

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return jobs
      .filter((job) => status === 'all' || job.status === status)
      .filter((job) => !normalized || [job.company, job.role, job.location || '', job.jd].join(' ').toLowerCase().includes(normalized))
      .toSorted((a, b) => {
        if (sort === 'company') return (a.company || '').localeCompare(b.company || '', 'zh-CN');
        if (sort === 'deadline') return (a.deadline || '9999-99-99').localeCompare(b.deadline || '9999-99-99');
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [jobs, query, sort, status]);

  if (!jobs.length) {
    return (
      <section className="workspace-panel px-6 py-14 text-center">
        <BriefcaseBusiness className="mx-auto size-8 text-slate-400" />
        <h2 className="mt-4 font-semibold">还没有岗位</h2>
        <p className="mt-2 text-sm text-muted-foreground">粘贴 JD，系统会自动匹配简历并开始修改。</p>
        <AppLink href="/jobs/new" data-interactive="true" className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-white">
          粘贴岗位 JD
        </AppLink>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="workspace-panel grid gap-3 p-3 sm:grid-cols-[minmax(260px,1fr)_180px_180px]">
        <div className="relative">
          <label htmlFor="jobs-query" className="sr-only">搜索岗位</label>
          <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-slate-400" />
          <Input id="jobs-query" value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 pl-9" placeholder="搜索公司、岗位或 JD 关键词" />
        </div>
        <div>
          <label htmlFor="jobs-status" className="sr-only">按状态筛选</label>
          <select id="jobs-status" value={status} onChange={(event) => setStatus(event.target.value as 'all' | JobStatus)} className="h-11 w-full rounded-lg border bg-white px-3 text-sm">
            <option value="all">全部状态</option>
            {jobStatuses.map((item) => <option key={item} value={item}>{jobStatusLabels[item]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="jobs-sort" className="sr-only">岗位排序</label>
          <select id="jobs-sort" value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className="h-11 w-full rounded-lg border bg-white px-3 text-sm">
            <option value="updated">最近更新</option>
            <option value="deadline">截止时间</option>
            <option value="company">公司名称</option>
          </select>
        </div>
      </section>

      <section className="workspace-panel overflow-hidden">
        <div className="flex items-center justify-between border-b px-5 py-3.5 text-sm text-muted-foreground">
          <span>共 {visible.length} 个岗位</span>
          <span className="hidden sm:inline">点击岗位进入完整工作台</span>
        </div>
        {visible.length ? (
          <div className="divide-y">
            {visible.map((job) => (
              <AppLink
                key={job.id}
                href={`/jobs/${job.id}`}
                data-interactive="true"
                className="interactive-row group grid gap-4 px-5 py-5 sm:grid-cols-[minmax(220px,.85fr)_minmax(260px,1.2fr)_150px_140px_24px] sm:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{job.company || '公司未识别'}</p>
                  <p className="mt-1 truncate text-sm text-[#58657a]">{job.role || '岗位未识别'}</p>
                </div>
                <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{job.jd}</p>
                <div className="text-sm">
                  <p>{job.location || '地点未填写'}</p>
                  <p className={job.deadline ? 'mt-1 text-xs text-muted-foreground' : 'mt-1 text-xs text-orange-700'}>
                    {job.deadline ? `截止 ${job.deadline}` : '待补截止时间'}
                  </p>
                </div>
                <span className="inline-flex w-fit items-center gap-2 rounded-md bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-[#465166]">
                  <span className="status-dot bg-primary" />
                  {jobStatusLabels[job.status as JobStatus] || job.status}
                </span>
                <ArrowRight className="hidden size-4 text-slate-400 transition-transform group-hover:translate-x-0.5 sm:block" />
              </AppLink>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <p className="font-medium">没有符合条件的岗位</p>
            <button type="button" onClick={() => { setQuery(''); setStatus('all'); }} className="mt-2 text-sm font-medium text-primary hover:underline">
              清除筛选
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
