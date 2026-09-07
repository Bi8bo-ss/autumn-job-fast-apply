'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AlertCircle, BriefcaseBusiness, GripVertical } from 'lucide-react';
import { jobStatusLabels, jobStatuses, type JobStatus } from '@/lib/product-types';
import type { JobRecord } from '@/lib/server/data';
import { cn } from '@/lib/utils';

export function PipelineBoard({ initial }: { initial: JobRecord[] }) {
  const [jobs, setJobs] = useState(initial);
  const [dragging, setDragging] = useState('');
  const [activeMobileStatus, setActiveMobileStatus] = useState<JobStatus>('wishlist');
  const [error, setError] = useState('');

  async function move(id: string, status: JobStatus) {
    const previous = jobs;
    setError('');
    setJobs((rows) => rows.map((job) => job.id === id ? { ...job, status } : job));
    try {
      const response = await fetch(`/api/jobs/${id}/status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error();
    } catch {
      setJobs(previous);
      setError('状态更新失败，已恢复到原来的阶段。请检查网络后重试。');
    }
  }

  const mobileJobs = useMemo(() => jobs.filter((job) => job.status === activeMobileStatus), [activeMobileStatus, jobs]);

  return (
    <div className="mx-auto max-w-[1420px] space-y-4">
      {error ? <p role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><AlertCircle className="size-4" />{error}</p> : null}

      <div className="hidden grid-cols-6 gap-3 lg:grid">
        {jobStatuses.map((status) => {
          const statusJobs = jobs.filter((job) => job.status === status);
          return (
            <section
              key={status}
              data-status={status}
              aria-label={`${jobStatusLabels[status]}岗位`}
              className={cn(
                'min-h-[560px] rounded-xl border bg-[#f1f4f8] p-2.5 transition-colors',
                dragging && 'border-dashed border-primary/35 bg-[#f4f7ff]',
              )}
            >
              <div className="mb-2.5 flex items-center justify-between px-1.5 py-1">
                <h2 className="text-sm font-semibold">{jobStatusLabels[status]}</h2>
                <span className="rounded-md bg-white px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">{statusJobs.length}</span>
              </div>
              <div className="space-y-2">
                {statusJobs.map((job) => (
                  <article key={job.id} className="rounded-lg border bg-white p-3 shadow-[0_2px_7px_-5px_rgb(15_23_42_/_35%)]">
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        draggable
                        onDragStart={() => setDragging(job.id)}
                        onDragEnd={(event) => {
                          const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-status]');
                          const nextStatus = target?.dataset.status as JobStatus | undefined;
                          if (nextStatus && nextStatus !== job.status) void move(job.id, nextStatus);
                          setDragging('');
                        }}
                        className="grid size-8 shrink-0 cursor-grab place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        aria-label={`拖动 ${job.company} ${job.role} 到其他阶段`}
                      >
                        <GripVertical className="size-4" aria-hidden="true" />
                      </button>
                      <Link href={`/jobs/${job.id}`} className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{job.company || '公司未识别'}</p>
                        <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">{job.role || '岗位未识别'}</p>
                      </Link>
                    </div>
                    <select
                      aria-label={`更新 ${job.company} ${job.role} 状态`}
                      value={job.status}
                      onChange={(event) => void move(job.id, event.target.value as JobStatus)}
                      className="mt-3 h-9 w-full rounded-lg border bg-white px-2 text-xs"
                    >
                      {jobStatuses.map((item) => <option key={item} value={item}>{jobStatusLabels[item]}</option>)}
                    </select>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div className="space-y-4 lg:hidden">
        <div className="workspace-panel overflow-x-auto p-1.5">
          <div className="flex min-w-max gap-1" role="tablist" aria-label="投递阶段">
            {jobStatuses.map((status) => (
              <button
                key={status}
                type="button"
                role="tab"
                aria-selected={activeMobileStatus === status}
                onClick={() => setActiveMobileStatus(status)}
                className={cn(
                  'min-h-10 rounded-lg px-3 text-sm font-medium',
                  activeMobileStatus === status ? 'bg-primary text-white' : 'text-muted-foreground',
                )}
              >
                {jobStatusLabels[status]} · {jobs.filter((job) => job.status === status).length}
              </button>
            ))}
          </div>
        </div>

        <section className="workspace-panel overflow-hidden">
          <div className="border-b px-4 py-3.5">
            <h2 className="font-semibold">{jobStatusLabels[activeMobileStatus]}</h2>
          </div>
          {mobileJobs.length ? (
            <div className="divide-y">
              {mobileJobs.map((job) => (
                <article key={job.id} className="p-4">
                  <Link href={`/jobs/${job.id}`} className="flex items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#edf3ff] text-primary"><BriefcaseBusiness className="size-4" /></span>
                    <span className="min-w-0">
                      <strong className="block truncate text-sm">{job.company || '公司未识别'}</strong>
                      <span className="mt-1 block truncate text-sm text-muted-foreground">{job.role || '岗位未识别'}</span>
                    </span>
                  </Link>
                  <label className="mt-4 block text-xs font-medium text-muted-foreground">
                    移动到
                    <select value={job.status} onChange={(event) => void move(job.id, event.target.value as JobStatus)} className="mt-2 h-11 w-full rounded-lg border bg-white px-3 text-sm text-foreground">
                      {jobStatuses.map((item) => <option key={item} value={item}>{jobStatusLabels[item]}</option>)}
                    </select>
                  </label>
                </article>
              ))}
            </div>
          ) : (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">这个阶段还没有岗位。</div>
          )}
        </section>
      </div>
    </div>
  );
}
