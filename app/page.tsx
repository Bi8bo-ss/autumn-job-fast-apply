import { ArrowUpRight, FileText, Sparkles } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Badge } from '@/components/ui/badge';
import { jobStatusLabels, jobStatuses } from '@/lib/product-types';
import { requirePageUser } from '@/lib/server/auth';
import { listJobs, listResumes } from '@/lib/server/data';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await requirePageUser('/');
  const [jobs, resumes] = await Promise.all([listJobs(user.userId), listResumes(user.userId)]);
  const counts = Object.fromEntries(jobStatuses.map((s) => [s, jobs.filter((j) => j.status === s).length]));
  return <AppShell title={`你好，${user.fullName || '继续推进今天的投递'}`} eyebrow="2027 届秋招 · 个人空间"><div className="space-y-7 pb-20 lg:pb-0">
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,.8fr)]">
      <div className="relative overflow-hidden rounded-2xl bg-[#0b2944] p-6 text-white sm:p-7"><div className="pointer-events-none absolute -right-16 -top-24 size-60 rounded-full border-[36px] border-white/[.04]" /><Badge className="border border-white/10 bg-white/10 text-white"><Sparkles /> AI 定向优化</Badge><h2 className="mt-4 max-w-xl text-[26px] font-semibold leading-tight tracking-tight sm:text-[30px]">从岗位 JD 到可投递简历，<br />每一步都清楚可控。</h2><p className="mt-3 max-w-lg text-sm leading-6 text-slate-300">粘贴岗位描述，逐条确认修改建议，生成岗位版简历和官网填写材料包。</p><div className="mt-6 flex flex-wrap gap-3"><a href="/jobs/new" className="rounded-xl bg-[#00a67d] px-4 py-2.5 text-sm font-medium">开始匹配岗位</a><a href="/resumes" className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm">管理简历版本</a></div></div>
      <div className="rounded-2xl bg-[#eaf8f4] p-6 text-[#123d35]"><p className="text-sm text-[#397264]">当前工作区</p><p className="mt-2 text-2xl font-semibold">{jobs.length} 个岗位 · {resumes.length} 份基础简历</p><div className="mt-8 grid grid-cols-3 gap-2 text-center"><Metric value={counts.wishlist} label="待投递" /><Metric value={counts.interview} label="面试" /><Metric value={counts.offer} label="Offer" /></div></div>
    </section>
    <section><div className="mb-3 flex items-end justify-between"><div><p className="text-xs font-medium text-primary">PIPELINE</p><h2 className="mt-1 text-lg font-semibold">投递进展</h2></div><a href="/pipeline" className="text-sm text-muted-foreground">查看看板 →</a></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">{jobStatuses.map((status) => <a key={status} href="/pipeline" className="rounded-xl border bg-card p-4 transition hover:-translate-y-0.5 hover:shadow-sm"><span className="text-sm text-muted-foreground">{jobStatusLabels[status]}</span><p className="mt-3 text-2xl font-semibold">{counts[status]}</p></a>)}</div></section>
    <section><div className="mb-3 flex items-end justify-between"><div><p className="text-xs font-medium text-primary">RECENT</p><h2 className="mt-1 text-lg font-semibold">最近处理</h2></div><a href="/jobs" className="text-sm text-muted-foreground">全部岗位</a></div>{jobs.length ? <div className="grid gap-3 xl:grid-cols-3">{jobs.slice(0, 6).map((job) => <a key={job.id} href={`/jobs/${job.id}`} className="group rounded-xl border bg-card p-4 transition hover:border-primary/30 hover:shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{job.company}</p><p className="mt-1 text-sm text-slate-700">{job.role}</p></div><Badge variant="outline">{jobStatusLabels[job.status as keyof typeof jobStatusLabels] || job.status}</Badge></div><p className="mt-4 flex items-center text-xs text-muted-foreground">继续处理 <ArrowUpRight className="ml-1 size-3.5" /></p></a>)}</div> : <Empty href="/jobs/new" text="还没有岗位，粘贴第一份 JD 开始匹配。" />}</section>
  </div></AppShell>;
}
function Metric({ value, label }: { value: number; label: string }) { return <div className="rounded-xl bg-white/70 px-2 py-3"><p className="text-lg font-semibold">{value}</p><p className="text-xs text-[#5f887d]">{label}</p></div>; }
function Empty({ href, text }: { href: string; text: string }) { return <a href={href} className="flex min-h-36 flex-col items-center justify-center rounded-2xl border border-dashed bg-white text-center text-sm text-muted-foreground"><FileText className="mb-3 size-6 text-primary" />{text}</a>; }
