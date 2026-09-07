'use client';

import Link from 'next/link';
import { useState, type SubmitEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Check, FileSearch, LoaderCircle, WandSparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ResumeRecord } from '@/lib/server/data';
import { cn } from '@/lib/utils';

type Stage = 'idle' | 'reading' | 'matching' | 'analyzing' | 'tuning';

const steps = [
  { id: 'reading', label: '识别岗位' },
  { id: 'matching', label: '匹配简历' },
  { id: 'analyzing', label: '分析要求' },
  { id: 'tuning', label: '生成建议' },
] as const;

export function JobForm({ resumes }: { resumes: ResumeRecord[] }) {
  const router = useRouter();
  const [jd, setJd] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState('');
  const busy = stage !== 'idle';
  const activeIndex = steps.findIndex((item) => item.id === stage);
  const resumeCount = resumes.filter((resume) => resume.currentVersionId).length;

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setStage('reading');
    try {
      const response = await fetch('/api/jobs/quick-start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jd, company, role }),
      });
      const data = await response.json() as {
        error?: string;
        job?: { id: string };
        matchedResume?: { resumeVersionId: string; resumeName: string } | null;
      };
      if (!response.ok || !data.job) throw new Error(data.error || '创建岗位失败，请重试。');

      setStage('matching');
      if (!data.matchedResume) {
        router.push(`/jobs/${data.job.id}?tab=tune&notice=no_resume`);
        router.refresh();
        return;
      }

      const body = JSON.stringify({ resumeVersionId: data.matchedResume.resumeVersionId });
      setStage('analyzing');
      const analysisResponse = await fetch(`/api/jobs/${data.job.id}/analyze`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body,
      });
      if (!analysisResponse.ok) {
        router.push(`/jobs/${data.job.id}?tab=tune&notice=ai_unavailable`);
        router.refresh();
        return;
      }

      setStage('tuning');
      const tuneResponse = await fetch(`/api/jobs/${data.job.id}/tune`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body,
      });
      router.push(`/jobs/${data.job.id}?tab=tune&notice=${tuneResponse.ok ? 'ready' : 'tune_failed'}`);
      router.refresh();
    } catch (reason) {
      setStage('idle');
      setError(reason instanceof Error ? reason.message : '创建岗位失败，请重试。');
    }
  }

  return (
    <div className="mx-auto max-w-[1120px] space-y-4">
      <section className="workspace-panel grid overflow-hidden lg:grid-cols-[minmax(0,1fr)_300px]">
        <form onSubmit={submit} className="p-5 sm:p-7">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#edf3ff] text-primary"><FileSearch className="size-5" /></span>
            <div>
              <h2 className="text-lg font-semibold">粘贴完整岗位描述</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">手动填写的公司和岗位不会被自动识别结果覆盖。</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="quick-company">公司名称 <span className="font-normal text-muted-foreground">选填</span></Label>
              <Input id="quick-company" value={company} onChange={(event) => setCompany(event.target.value)} maxLength={120} disabled={busy} autoComplete="organization" placeholder="留空则从 JD 识别" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-role">岗位名称 <span className="font-normal text-muted-foreground">选填</span></Label>
              <Input id="quick-role" value={role} onChange={(event) => setRole(event.target.value)} maxLength={160} disabled={busy} placeholder="留空则从 JD 识别" />
            </div>
          </div>

          <div className="mt-5">
            <Label htmlFor="quick-jd">岗位描述</Label>
            <Textarea
              id="quick-jd"
              value={jd}
              onChange={(event) => setJd(event.target.value)}
              required
              minLength={30}
              maxLength={40000}
              disabled={busy}
              className="mt-2 min-h-[360px] resize-y bg-[#fbfcfe] p-4 text-[15px] leading-7 focus:bg-white"
              placeholder={'直接粘贴招聘官网或招聘软件里的完整 JD…\n\n例如：\n公司名称：某某科技\n招聘岗位：产品经理实习生\n岗位职责：…'}
            />
            <div className="mt-2 flex items-center justify-between gap-4 text-xs text-muted-foreground">
              <span>{resumeCount ? `将从 ${resumeCount} 份基础简历中自动匹配` : '没有基础简历也可先保存岗位'}</span>
              <span className="tabular-nums">{jd.length.toLocaleString()} / 40,000</span>
            </div>
          </div>

          {error ? <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error} 请检查内容后重试。</p> : null}
          <div className="mt-6 flex justify-end">
            <Button size="lg" type="submit" disabled={busy || jd.trim().length < 30}>
              {busy ? <LoaderCircle className="animate-spin" /> : <WandSparkles />}
              {busy ? '正在准备岗位…' : '开始匹配'}
            </Button>
          </div>
        </form>

        <aside className="border-t bg-[#f8faff] p-5 lg:border-l lg:border-t-0 sm:p-6">
          <h3 className="font-semibold">提交后会发生什么</h3>
          <ol className="mt-5 space-y-5">
            {steps.map((item, index) => {
              const done = busy && activeIndex > index;
              const active = busy && activeIndex === index;
              return (
                <li key={item.id} className="flex gap-3">
                  <span className={cn(
                    'grid size-7 shrink-0 place-items-center rounded-full border bg-white text-xs font-semibold',
                    done && 'border-emerald-500 bg-emerald-500 text-white',
                    active && 'border-primary text-primary ring-4 ring-primary/10',
                  )}>
                    {done ? <Check className="size-4" /> : index + 1}
                  </span>
                  <div>
                    <p className={cn('text-sm font-medium', active && 'text-primary')}>{item.label}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{[
                      '提取公司、岗位与地点',
                      '选择最合适的事实版本',
                      '整理要求、优势与缺口',
                      '进入逐条修改工作台',
                    ][index]}</p>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className={cn('mt-7 rounded-lg border px-4 py-3 text-sm leading-6', resumeCount ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-orange-200 bg-orange-50 text-orange-900')}>
            {resumeCount ? `已有 ${resumeCount} 份可匹配基础简历。` : '尚未导入基础简历。岗位会保存，但无法自动微调。'}
            {!resumeCount ? <Link href="/resumes" className="ml-1 font-semibold underline underline-offset-2">先去导入</Link> : null}
          </div>
        </aside>
      </section>
    </div>
  );
}
