'use client';

import { useState, type SubmitEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Check, FileSearch, Sparkles, WandSparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ResumeRecord } from '@/lib/server/data';
import { cn } from '@/lib/utils';

type Stage = 'idle' | 'reading' | 'matching' | 'analyzing' | 'tuning';

export function JobForm({ resumes }: { resumes: ResumeRecord[] }) {
  const router = useRouter();
  const [jd, setJd] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState('');
  const busy = stage !== 'idle';

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setStage('reading');
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
    if (!response.ok || !data.job) {
      setStage('idle');
      setError(data.error || '创建岗位失败，请重试。');
      return;
    }

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
  }

  const steps = [
    { id: 'reading', label: '识别岗位信息' },
    { id: 'matching', label: '匹配简历版本' },
    { id: 'analyzing', label: '分析岗位要求' },
    { id: 'tuning', label: '生成修改建议' },
  ] as const;
  const activeIndex = steps.findIndex((item) => item.id === stage);
  const resumeCount = resumes.filter((resume) => resume.currentVersionId).length;

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-24">
      <form onSubmit={submit} className="surface-card overflow-hidden">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-emerald-50/50 p-5 sm:p-7">
          <div className="flex items-start gap-4">
            <span className="icon-tile"><FileSearch className="size-5" /></span>
            <div><h2 className="text-lg font-semibold tracking-[-0.02em]">填写岗位并粘贴 JD</h2><p className="mt-1.5 text-sm leading-6 text-muted-foreground">公司和岗位可以直接填写；留空时才会从 JD 自动识别，手填内容不会被覆盖。</p></div>
          </div>
        </div>
        <div className="p-5 sm:p-7">
          <div className="mb-5 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="quick-company">公司名称 <span className="font-normal text-muted-foreground">选填</span></Label>
              <Input id="quick-company" value={company} onChange={(event) => setCompany(event.target.value)} maxLength={120} disabled={busy} autoComplete="organization" placeholder="留空则从 JD 自动识别" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-role">岗位名称 <span className="font-normal text-muted-foreground">选填</span></Label>
              <Input id="quick-role" value={role} onChange={(event) => setRole(event.target.value)} maxLength={160} disabled={busy} placeholder="留空则从 JD 自动识别" />
            </div>
          </div>
          <label htmlFor="quick-jd" className="sr-only">岗位描述</label>
          <Textarea id="quick-jd" value={jd} onChange={(event) => setJd(event.target.value)} required minLength={30} maxLength={40000} disabled={busy} className="min-h-[330px] resize-y border-slate-200 bg-slate-50/50 p-4 text-[15px] leading-7 focus:bg-white" placeholder={'把招聘官网、公众号或招聘软件里的完整 JD 直接粘贴到这里…\n\n例如：\n公司名称：某某科技\n招聘岗位：产品经理实习生\n岗位职责：…'} />
          <div className="mt-3 flex items-center justify-between gap-4 text-xs text-muted-foreground"><span>{resumeCount ? `会在 ${resumeCount} 份基础简历中自动匹配` : '尚无可匹配的基础简历，岗位仍会正常保存'}</span><span>{jd.length.toLocaleString()} / 40,000</span></div>
          {error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          <div className="mt-6 flex justify-end"><Button size="lg" type="submit" disabled={busy || jd.trim().length < 30}><WandSparkles />{busy ? '正在自动处理…' : '自动匹配并开始修改'}</Button></div>
        </div>
      </form>

      {busy ? <section aria-live="polite" className="surface-card p-5 sm:p-6"><div className="mb-5 flex items-center gap-3"><Sparkles className="size-5 animate-pulse text-primary" /><div><p className="font-semibold">正在准备岗位版简历</p><p className="mt-1 text-sm text-muted-foreground">完成后会直接进入逐条修改建议。</p></div></div><div className="grid gap-2 sm:grid-cols-4">{steps.map((item, index) => { const done = activeIndex > index; const active = activeIndex === index; return <div key={item.id} className={cn('flex items-center gap-2 rounded-xl border px-3 py-3 text-sm transition', done && 'border-emerald-200 bg-emerald-50 text-emerald-800', active && 'border-primary/30 bg-primary/5 text-primary', !done && !active && 'text-muted-foreground')}><span className={cn('grid size-5 shrink-0 place-items-center rounded-full border text-[10px]', done && 'border-emerald-500 bg-emerald-500 text-white', active && 'border-primary')}>{done ? <Check className="size-3" /> : index + 1}</span>{item.label}</div>; })}</div></section> : null}
    </div>
  );
}
