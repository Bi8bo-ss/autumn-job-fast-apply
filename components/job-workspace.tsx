'use client';

import Image from 'next/image';
import { type SubmitEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Eye,
  FileDown,
  LoaderCircle,
  MapPin,
  MessageCircle,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { AppLink } from '@/components/app-link';
import { OverleafCopyButton } from '@/components/overleaf-copy-button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  jobStatusLabels,
  jobStatuses,
  type ApplicationPackContent,
  type JobAnalysis,
  type ResumeContent,
  type TuneSuggestion,
} from '@/lib/product-types';
import type { JobRecord } from '@/lib/server/data';
import { RESUME_PORTRAIT_PATH } from '@/lib/resume-portrait';
import { buildResumePreviewContent } from '@/lib/resume-preview';
import { skillNames } from '@/lib/resume-skills';
import { decodeMergeSourceTexts, normalizeSuggestedResumeText, parseSuggestionSection, resumeBulletParts } from '@/lib/resume-suggestions';

type WorkspaceVersion = {
  id: string;
  resumeId: string;
  jobId: string | null;
  parentVersionId: string | null;
  versionNumber: number;
  contentJson: string;
  sourceText: string;
  createdAt: string;
  resumeName: string;
  language: 'zh' | 'en';
};

type TuneRun = {
  id: string;
  resumeVersionId: string;
  status: string;
  analysisJson?: string | null;
  createdAt?: string;
};

type PackRecord = {
  id: string;
  resumeVersionId: string;
  contentJson: string;
  createdAt: string;
  updatedAt: string;
};

type AnswerRecord = { id: string; question: string; answer: string; charLimit?: number | null; createdAt?: string };
type WorkspaceSuggestion = TuneSuggestion & { needsUserInput: boolean | number };
type WorkspaceData = {
  job: JobRecord;
  versions: WorkspaceVersion[];
  run: TuneRun | null;
  suggestions: WorkspaceSuggestion[];
  pack: PackRecord | null;
  answers: AnswerRecord[];
};

type WorkspaceTab = 'job' | 'analysis' | 'tune' | 'pack' | 'exports';
const workspaceTabs: Array<{ id: WorkspaceTab; label: string; shortLabel: string }> = [
  { id: 'job', label: '岗位信息', shortLabel: '岗位' },
  { id: 'analysis', label: '匹配分析', shortLabel: '匹配' },
  { id: 'tune', label: '岗位定向改写', shortLabel: '改写' },
  { id: 'pack', label: '填写材料', shortLabel: '材料' },
  { id: 'exports', label: '导出', shortLabel: '导出' },
];

export function JobWorkspace({
  data,
  initialTab,
  initialNotice,
}: {
  data: WorkspaceData;
  initialTab?: string;
  initialNotice?: string;
}) {
  const router = useRouter();
  const { job, versions } = data;
  const base = versions
    .filter((version) => !version.jobId && !version.parentVersionId)
    .filter((version, _index, roots) => !roots.some((candidate) => candidate.resumeId === version.resumeId
      && candidate.versionNumber < version.versionNumber));
  const branches = versions.filter((version) => version.jobId === job.id);
  const runBase = base.find((version) => version.id === data.run?.resumeVersionId);
  const safeInitialTab = workspaceTabs.some((item) => item.id === initialTab) ? initialTab as WorkspaceTab : 'job';
  const noticeText = getNotice(initialNotice);
  const [tab, setTab] = useState<WorkspaceTab>(safeInitialTab);
  const [selected, setSelected] = useState(runBase?.id || base[0]?.id || '');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState(noticeText);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<WorkspaceSuggestion[]>(data.suggestions || []);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [generatedVersion, setGeneratedVersion] = useState<{ id: string; versionNumber: number } | null>(null);
  const autoFinalizeStarted = useRef(false);

  const analysis = useMemo<JobAnalysis | null>(() => {
    try { return job.analysisJson ? JSON.parse(job.analysisJson) as JobAnalysis : null; } catch { return null; }
  }, [job.analysisJson]);
  const pack = useMemo<ApplicationPackContent | null>(() => {
    try { return data.pack?.contentJson ? JSON.parse(data.pack.contentJson) as ApplicationPackContent : null; } catch { return null; }
  }, [data.pack]);

  const activeSuggestion = suggestions.find((item) => item.state === 'pending');
  const processedSuggestions = suggestions.filter((item) => item.state !== 'pending');
  const activeNumber = activeSuggestion ? suggestions.findIndex((item) => item.id === activeSuggestion.id) + 1 : suggestions.length;
  const previewVersion = runBase || base.find((item) => item.id === selected) || base[0];
  const previewContent = useMemo<ResumeContent | null>(
    () => buildResumePreviewContent(previewVersion, suggestions, activeSuggestion, drafts),
    [previewVersion, suggestions, activeSuggestion, drafts],
  );
  const previewHighlight = useMemo(
    () => getActivePreviewHighlight(activeSuggestion, drafts, previewContent),
    [activeSuggestion, drafts, previewContent],
  );
  const existingOutput = data.run?.status === 'finalized' ? branches[0] : null;
  const outputVersion = generatedVersion || existingOutput;

  const finalizeResume = useCallback(async () => {
    setBusy('auto-finalize');
    setError('');
    setMessage('');
    try {
      const response = await fetch(`/api/jobs/${job.id}/resume-versions`, { method: 'POST' });
      const result = await response.json() as { error?: string; version?: { id: string; versionNumber: number } };
      if (!response.ok || !result.version) throw new Error(result.error || '生成岗位简历失败。');
      setGeneratedVersion(result.version);
      setMessage('岗位版简历已生成，可以立即导出。');
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '生成岗位简历失败。');
    } finally {
      setBusy('');
    }
  }, [job.id, router]);

  useEffect(() => {
    if (!suggestions.length || suggestions.some((item) => item.state === 'pending') || data.run?.status !== 'ready' || autoFinalizeStarted.current) return;
    autoFinalizeStarted.current = true;
    void finalizeResume();
  }, [data.run?.status, finalizeResume, suggestions]);

  async function call(path: string, body?: unknown) {
    setBusy(path);
    setError('');
    setMessage('');
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || '操作失败，请重试。');
      setMessage('已完成，内容已更新。');
      router.refresh();
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '操作失败，请重试。');
      return false;
    } finally {
      setBusy('');
    }
  }

  async function updateStatus(value: string) {
    const response = await fetch(`/api/jobs/${job.id}/status`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: value }),
    });
    if (response.ok) router.refresh();
    else setError('状态更新失败，请重试。');
  }

  return (
    <div className="mx-auto max-w-[1420px] space-y-4">
      <section className="workspace-panel flex flex-col gap-4 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#58657a]">
          <AppLink href="/jobs" className="inline-flex items-center gap-1 font-medium text-primary hover:underline"><ChevronLeft className="size-4" />全部岗位</AppLink>
          <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" />{job.location || '地点未填写'}</span>
          <span className={cn('inline-flex items-center gap-1.5', !job.deadline && 'font-medium text-orange-700')}>
            {!job.deadline ? <AlertTriangle className="size-4" /> : null}
            {job.deadline ? `截止 ${job.deadline}` : '截止时间未填写'}
          </span>
          {job.sourceUrl ? <a className="font-medium text-primary hover:underline" href={job.sourceUrl} target="_blank" rel="noreferrer">打开岗位来源</a> : null}
        </div>
        <label className="flex items-center gap-2 text-sm font-medium">
          状态
          <select value={job.status} onChange={(event) => void updateStatus(event.target.value)} className="h-10 rounded-lg border bg-white px-3 text-sm">
            {jobStatuses.map((status) => <option key={status} value={status}>{jobStatusLabels[status]}</option>)}
          </select>
        </label>
      </section>

      {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}
      {message ? <p aria-live="polite" className="callout-success">{message}</p> : null}

      <div className="workspace-panel overflow-hidden">
        <div role="tablist" aria-label="岗位工作区" className="flex min-w-0 sm:min-w-[620px]">
          {workspaceTabs.map((item, index) => {
            const active = tab === item.id;
            const completed = workspaceTabs.findIndex((entry) => entry.id === tab) > index;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(item.id)}
                className={cn(
                  'relative flex min-h-[66px] min-w-0 flex-1 flex-col items-center justify-center gap-1 border-r px-1.5 text-center last:border-r-0 sm:flex-row sm:justify-start sm:gap-3 sm:px-4 sm:text-left',
                  active ? 'bg-[#f3f7ff] text-primary' : 'text-[#58657a] hover:bg-slate-50',
                )}
              >
                <span className={cn(
                  'grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold',
                  active && 'border-primary bg-primary text-white',
                  completed && 'border-emerald-600 bg-emerald-600 text-white',
                )}>{completed ? <Check className="size-4" /> : index + 1}</span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold sm:hidden">{item.shortLabel}</span>
                  <span className="hidden text-sm font-semibold sm:block">{item.label}</span>
                  <span className="mt-0.5 hidden text-xs text-muted-foreground sm:block">{index < 2 ? '准备与验证' : index === 2 ? '当前核心步骤' : '完成投递材料'}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {tab === 'job' ? (
        <Panel title="岗位描述">
          <pre className="max-w-[80ch] whitespace-pre-wrap font-sans text-[15px] leading-8 text-[#354057]">{job.jd}</pre>
        </Panel>
      ) : null}

      {tab === 'analysis' ? (
        <Panel
          title="岗位匹配分析"
          action={<ActionSetup base={base} selected={selected} setSelected={setSelected} label={analysis ? '重新分析' : '开始分析'} busy={busy.includes('analyze')} disabled={!selected} onClick={() => void call(`/api/jobs/${job.id}/analyze`, { resumeVersionId: selected })} />}
        >
          {analysis ? <Analysis analysis={analysis} /> : <Empty text={base.length ? '选择基础简历后，系统会整理岗位要求、关键词、优势与缺口。' : '请先到“简历”导入一份基础简历。'} action={!base.length ? { href: '/resumes', label: '导入基础简历' } : undefined} />}
        </Panel>
      ) : null}

      {tab === 'tune' ? (
        <div className="space-y-4">
          <section className="workspace-panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="font-semibold">岗位定向改写</h2>
                {analysis ? <span className="rounded-md bg-[#edf3ff] px-2.5 py-1 text-xs font-semibold text-primary">岗位匹配 {analysis.score}%</span> : null}
                {suggestions.length ? <span className="text-xs font-medium text-muted-foreground">当前建议 {activeNumber} / {suggestions.length}</span> : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">每次都从导入的原始基础版重新开始，不叠加任何岗位版修改；再逐条新增、删除、合并或改写。</p>
            </div>
            <ActionSetup base={base} selected={selected} setSelected={setSelected} label="重新生成" busy={busy.includes('/tune')} disabled={!selected} onClick={() => void call(`/api/jobs/${job.id}/tune`, { resumeVersionId: selected })} />
          </section>

          <MobileResumePreview content={previewContent} resumeName={previewVersion?.resumeName || '简历预览'} active={Boolean(activeSuggestion)} highlightText={previewHighlight} />

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.28fr)_minmax(400px,.72fr)]">
            <div className="hidden xl:sticky xl:top-[88px] xl:block">
              <ResumePreview content={previewContent} resumeName={previewVersion?.resumeName || '简历预览'} active={Boolean(activeSuggestion)} highlightText={previewHighlight} />
            </div>
            <div className="space-y-4">
              {activeSuggestion ? (
                <Suggestion
                  key={activeSuggestion.id}
                  suggestion={activeSuggestion}
                  current={activeNumber}
                  total={suggestions.length}
                  onDraft={(value) => setDrafts((current) => ({ ...current, [activeSuggestion.id]: value }))}
                  onChange={(updates) => setSuggestions((current) => current.map((item) => item.id === activeSuggestion.id ? { ...item, ...updates } : item))}
                />
              ) : suggestions.length && busy === 'auto-finalize' ? (
                <LoadingFinal />
              ) : outputVersion ? (
                <ExportReady version={outputVersion} />
              ) : suggestions.length ? (
                <section className="workspace-panel p-6 text-center">
                  <Check className="mx-auto size-8 text-emerald-600" />
                  <p className="mt-3 font-semibold">建议已全部处理</p>
                  <p className="mt-1 text-sm text-muted-foreground">确认内容无误后，生成不可变的岗位版简历。</p>
                  <Button className="mt-4" onClick={() => void finalizeResume()}><FileDown />生成岗位版简历</Button>
                </section>
              ) : (
                <Empty text="选择基础简历并生成建议后，这里会一次展示一条修改。" action={!base.length ? { href: '/resumes', label: '导入基础简历' } : undefined} />
              )}

              {processedSuggestions.length ? (
                <details className="workspace-panel overflow-hidden">
                  <summary className="cursor-pointer list-none px-4 py-3.5 text-sm font-medium text-[#465166] [&::-webkit-details-marker]:hidden">
                    已处理建议（{processedSuggestions.length}）
                  </summary>
                  <div className="divide-y border-t">
                    {processedSuggestions.map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                        <p className="line-clamp-2 leading-6 text-muted-foreground">{parseSuggestionSection(item.sectionKey).operation === 'delete' && !item.editedText ? `删除：${item.originalText}` : item.editedText || item.proposedText}</p>
                        <Badge variant={item.state === 'accepted' ? 'secondary' : 'outline'}>{item.state === 'accepted' ? '已接受' : '已跳过'}</Badge>
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}

              <JobAiChat jobId={job.id} resumeVersionId={previewVersion?.id || selected} />
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'pack' ? (
        <div className="space-y-4">
          <Panel title="官网填写材料包" action={<Button onClick={() => void call(`/api/jobs/${job.id}/application-pack`)} disabled={busy.includes('application-pack')}>{busy.includes('application-pack') ? '生成中…' : pack ? '从最新简历重新生成' : '从简历生成材料包'}</Button>}>
            {pack ? <PackView pack={pack} /> : <Empty text="系统会逐字读取该岗位最新简历中的教育、全部经历、项目和技能，不会用个人档案扩写简历内容。" />}
          </Panel>
          {pack ? <CustomAnswer jobId={job.id} answers={data.answers || []} onDone={() => router.refresh()} /> : null}
        </div>
      ) : null}

      {tab === 'exports' ? (
        <Panel title="岗位简历版本">
          {branches.length ? (
            <div className="divide-y rounded-lg border">
              {branches.map((version) => (
                <div key={version.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{version.resumeName} · v{version.versionNumber}</p>
                    <p className="mt-1 text-xs text-muted-foreground">生成于 {new Date(version.createdAt).toLocaleString('zh-CN')} · 内容快照不可变</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a className={buttonVariants({ variant: 'outline', size: 'sm' })} href={`/api/resume-versions/${version.id}/export?format=docx`}><FileDown />DOCX</a>
                    <a className={buttonVariants({ variant: 'outline', size: 'sm' })} target="_blank" rel="noreferrer" href={`/api/resume-versions/${version.id}/export?format=pdf`}><FileDown />PDF</a>
                    <OverleafCopyButton versionId={version.id} />
                  </div>
                </div>
              ))}
            </div>
          ) : <Empty text="确认全部微调建议并生成岗位版简历后，这里会出现可重复导出的版本。" />}
        </Panel>
      ) : null}
    </div>
  );
}

function getNotice(notice?: string) {
  if (notice === 'ready') return '已自动匹配基础简历并生成修改建议，请逐条确认。';
  if (notice === 'no_resume') return '岗位已保存，但还没有可匹配的基础简历。导入后即可开始微调。';
  if (notice === 'ai_unavailable') return '岗位和简历匹配已完成，但 AI 尚未连接。请到“AI 设置”检查连接。';
  if (notice === 'tune_failed') return '岗位分析已完成，但修改建议生成失败。可以在下方重新生成。';
  return '';
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="workspace-panel p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function ActionSetup({
  base,
  selected,
  setSelected,
  label,
  busy,
  disabled,
  onClick,
}: {
  base: WorkspaceVersion[];
  selected: string;
  setSelected: (value: string) => void;
  label: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <select value={selected} onChange={(event) => setSelected(event.target.value)} className="h-10 min-w-48 rounded-lg border bg-white px-3 text-sm">
        <option value="">选择原始基础简历</option>
        {base.map((version) => <option key={version.id} value={version.id}>{version.resumeName} · 原始版</option>)}
      </select>
      <Button onClick={onClick} disabled={disabled || busy}><Sparkles />{busy ? '处理中…' : label}</Button>
    </div>
  );
}

function getActivePreviewHighlight(
  active: WorkspaceSuggestion | undefined,
  drafts: Record<string, string>,
  content: ResumeContent | null,
) {
  if (!active || !content) return '';
  const target = parseSuggestionSection(active.sectionKey);
  const draft = drafts[active.id] ?? active.editedText ?? active.proposedText;
  if (!draft.trim()) return '';
  const text = normalizeSuggestedResumeText(
    target.section,
    target.operation === 'merge' ? '' : active.originalText,
    draft,
    content.language,
  );
  if (target.section === 'skills') {
    const names = new Set(skillNames(text));
    return content.skills.find((line) => skillNames(line).some((name) => names.has(name))) || '';
  }
  return text;
}

function MobileResumePreview({ content, resumeName, active, highlightText }: { content: ResumeContent | null; resumeName: string; active: boolean; highlightText: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="xl:hidden">
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}><Eye />查看实时简历预览</Button>
      {open ? (
        <dialog open className="fixed inset-0 z-50 m-0 h-dvh max-h-none w-screen max-w-none bg-[#edf1f6]" aria-label="实时简历预览">
          <div className="flex h-14 items-center justify-between border-b bg-white px-4">
            <p className="font-semibold">实时简历预览</p>
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}><X />关闭</Button>
          </div>
          <div className="h-[calc(100dvh-56px)] overflow-auto p-3"><ResumePreview content={content} resumeName={resumeName} active={active} highlightText={highlightText} embedded /></div>
        </dialog>
      ) : null}
    </div>
  );
}

function ResumePreview({ content, resumeName, active, highlightText, embedded = false }: { content: ResumeContent | null; resumeName: string; active: boolean; highlightText: string; embedded?: boolean }) {
  const pageRef = useRef<HTMLDivElement>(null);
  const resumeRef = useRef<HTMLElement>(null);
  const [portraitAvailable, setPortraitAvailable] = useState(true);

  useEffect(() => {
    const page = pageRef.current;
    const resume = resumeRef.current;
    if (!page || !resume) return;

    const fit = () => {
      if (!page.clientWidth) return;
      page.style.height = `${page.clientWidth * 297 / 210}px`;
      const available = page.clientHeight * 0.985;
      const apply = (scale: number) => {
        resume.style.width = `${100 / scale}%`;
        resume.style.transform = `scale(${scale})`;
        return resume.scrollHeight * scale;
      };
      let low = 0.25;
      let high = 1;
      if (apply(1) <= available) return;
      for (let index = 0; index < 16; index += 1) {
        const middle = (low + high) / 2;
        if (apply(middle) <= available) low = middle;
        else high = middle;
      }
      apply(low);
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(page);
    return () => observer.disconnect();
  }, [content]);

  return (
    <section className={cn('overflow-hidden rounded-xl border bg-[#dfe3e8]', embedded && 'border-0')}>
      <div className="flex items-center justify-between border-b bg-white px-4 py-3">
        <div>
          <p className="text-sm font-semibold">岗位版简历预览：{resumeName}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{active ? '含当前编辑草稿 · 确认后保存' : '已接受的修改'} · A4 单页自适应</p>
        </div>
        <span className={cn('inline-flex items-center gap-2 text-xs font-medium', active ? 'text-emerald-700' : 'text-muted-foreground')}>
          <span className={cn('status-dot', active ? 'bg-emerald-500' : 'bg-slate-400')} />
          {active ? '实时更新' : '最终效果'}
        </span>
      </div>
      <div className={cn('overflow-y-auto p-3 sm:p-5', embedded ? 'max-h-none' : 'max-h-[calc(100vh-185px)]')}>
        {content ? (
          <div ref={pageRef} className="mx-auto aspect-[210/297] w-full max-w-[760px] overflow-hidden bg-white shadow-[0_10px_26px_-14px_rgb(15_23_42_/_40%)]">
            <article ref={resumeRef} className="flow-root w-full origin-top-left bg-white px-[7.6%] py-[7.1%] font-['Microsoft_YaHei',Arial,sans-serif] text-black">
            {portraitAvailable ? <Image src={RESUME_PORTRAIT_PATH} alt="" width={195} height={294} unoptimized onError={() => setPortraitAvailable(false)} className="float-right mb-2 ml-[5%] aspect-[195/294] w-[11.2%] object-cover" /> : null}
            <h1 className="break-words text-[24px] font-bold leading-none tracking-tight">{content.headline}</h1>
            {content.summary ? <p className={cn('mt-2 whitespace-pre-wrap break-words text-[11px] leading-[1.35]', isHighlighted(content.summary, highlightText) && 'rounded-r border-l-2 border-emerald-500 bg-emerald-100/80 px-1')} title={isHighlighted(content.summary, highlightText) ? '当前修改位置' : undefined}>{content.summary}</p> : null}
            <PreviewSection title={content.language === 'zh' ? '教育经历' : 'EDUCATION'} lines={content.education} highlightText={highlightText} />
            <PreviewEntries title={content.language === 'zh' ? '实习经历' : 'EXPERIENCE'} entries={content.experiences} language={content.language} highlightText={highlightText} />
            <PreviewEntries title={content.language === 'zh' ? '项目经历' : 'PROJECTS'} entries={content.projects} language={content.language} highlightText={highlightText} />
            <PreviewSection title={content.language === 'zh' ? '技能' : 'SKILLS'} lines={content.skills} highlightText={highlightText} />
            <PreviewSection title={content.language === 'zh' ? '其他信息' : 'ADDITIONAL'} lines={content.extras} highlightText={highlightText} />
            </article>
          </div>
        ) : (
          <div className="grid min-h-72 place-items-center rounded-lg border border-dashed border-slate-300 bg-white/60 px-6 text-center text-sm text-muted-foreground">选择基础简历后显示预览</div>
        )}
      </div>
    </section>
  );
}

function PreviewSection({ title, lines, highlightText = '' }: { title: string; lines: string[]; highlightText?: string }) {
  if (!lines.length) return null;
  return <section className="mt-[7px]"><h2 className="border-b border-black pb-[2px] text-[13px] font-bold leading-none">{title}</h2><div className="mt-[3px]">{lines.map((line, index) => <p key={index} className={cn('whitespace-pre-wrap break-words text-[11px] leading-[1.35]', isHighlighted(line, highlightText) && 'rounded-r border-l-2 border-emerald-500 bg-emerald-100/80 px-1')} title={isHighlighted(line, highlightText) ? '当前修改位置' : undefined}>{line}</p>)}</div></section>;
}

function PreviewEntries({ title, entries, language, highlightText }: { title: string; entries: ResumeContent['experiences']; language: ResumeContent['language']; highlightText: string }) {
  if (!entries.length) return null;
  return (
    <section className="mt-[7px]">
      <h2 className="border-b border-black pb-[2px] text-[13px] font-bold leading-none">{title}</h2>
      <div className="mt-[3px] space-y-[5px]">
        {entries.map((entry, index) => (
          <div key={index}>
            <div className="flex items-baseline justify-between gap-3"><p className="text-[11.5px] font-bold leading-[1.3]">{entry.heading}</p><p className="shrink-0 text-[9.5px] font-bold leading-[1.2]">{entry.meta}</p></div>
            <ul className="mt-[1px]">{entry.bullets.map((bullet, itemIndex) => <PreviewBullet key={itemIndex} bullet={bullet} language={language} highlighted={isHighlighted(bullet, highlightText)} />)}</ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function PreviewBullet({ bullet, language, highlighted }: { bullet: string; language: ResumeContent['language']; highlighted: boolean }) {
  const { lead, rest } = resumeBulletParts(bullet, language);
  return (
    <li className={cn('flex gap-2 text-[11px] leading-[1.35]', highlighted && 'rounded-r border-l-2 border-emerald-500 bg-emerald-100/80 px-1')} title={highlighted ? '当前修改位置' : undefined}>
      <span aria-hidden="true">-</span>
      <span><strong>{lead}</strong>{language === 'en' ? ' ' : ''}{rest}</span>
    </li>
  );
}

function isHighlighted(value: string, highlightText: string) {
  return Boolean(highlightText) && value.trim().replace(/\s+/g, ' ') === highlightText.trim().replace(/\s+/g, ' ');
}

type ChatMessage = { role: 'user' | 'assistant'; content: string };
type DiffPart = { value: string; kind: 'same' | 'added' | 'removed' };

function JobAiChat({ jobId, resumeVersionId }: { jobId: string; resumeVersionId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function send(messageOverride?: string) {
    const message = (messageOverride ?? input).trim();
    if (!message || busy || !resumeVersionId) return;
    const history = messages.slice(-12);
    setMessages((current) => [...current, { role: 'user', content: message }]);
    setInput('');
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/jobs/${jobId}/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message, resumeVersionId, history }),
      });
      const result = await response.json().catch(() => ({})) as { answer?: string; error?: string };
      if (!response.ok || !result.answer) throw new Error(result.error || 'AI 暂时没有回复。');
      setMessages((current) => [...current, { role: 'assistant', content: result.answer as string }]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'AI 暂时没有回复，请重试。');
    } finally {
      setBusy(false);
    }
  }

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    void send();
  }

  return (
    <details className="workspace-panel group overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><MessageCircle className="size-4.5" /></span>
          <span>
            <span className="block text-sm font-semibold">岗位 AI 助手</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">问 JD、简历表达或补充方向，不会直接改动简历</span>
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
      </summary>
      <div className="border-t bg-[#fbfcfe] p-4">
        {!messages.length ? (
          <div>
            <p className="text-sm leading-6 text-muted-foreground">我会结合当前 JD、原始基础简历和事实库回答。资料没有证明的能力，我会先向你确认。</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {['这个 JD 最看重什么？', '我还缺哪些关键证据？', '检查当前简历的内容取舍'].map((prompt) => (
                <button key={prompt} type="button" disabled={!resumeVersionId || busy} onClick={() => void send(prompt)} className="rounded-full border bg-white px-3 py-1.5 text-xs font-medium text-[#465166] transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary disabled:opacity-50">{prompt}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-h-80 space-y-3 overflow-y-auto pr-1" aria-live="polite">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                <p className={cn('max-w-[92%] whitespace-pre-wrap rounded-xl px-3.5 py-2.5 text-sm leading-6', message.role === 'user' ? 'bg-primary text-white' : 'border bg-white text-[#354057]')}>{message.content}</p>
              </div>
            ))}
            {busy ? <p className="inline-flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />正在结合 JD 和原始简历思考…</p> : null}
          </div>
        )}
        {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
        <form onSubmit={submit} className="mt-4 flex items-end gap-2">
          <Textarea
            aria-label="向岗位 AI 助手提问"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={resumeVersionId ? '例如：如果我会 Tableau，放在哪一行最合适？' : '请先选择一份原始基础简历'}
            className="min-h-20 resize-none bg-white text-sm"
            disabled={!resumeVersionId || busy}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
          />
          <Button type="submit" size="icon" className="size-11 shrink-0" disabled={!input.trim() || !resumeVersionId || busy} aria-label="发送消息"><Send /></Button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">当前页面会话，刷新后清空；回答仅供参考，不会自动接受建议或写入简历。</p>
      </div>
    </details>
  );
}

function tokenizeDiffText(value: string) {
  if (!value) return [];
  if (typeof Intl.Segmenter === 'function') {
    return Array.from(new Intl.Segmenter('zh-CN', { granularity: 'word' }).segment(value), (part) => part.segment);
  }
  return value.match(/[\p{Script=Han}]|[A-Za-z0-9]+(?:[.+#/-][A-Za-z0-9]+)*|\s+|./gu) || [];
}

function diffText(before: string, after: string): DiffPart[] {
  const oldTokens = tokenizeDiffText(before);
  const newTokens = tokenizeDiffText(after);
  if (!oldTokens.length) return after ? [{ value: after, kind: 'added' }] : [];
  if (!newTokens.length) return before ? [{ value: before, kind: 'removed' }] : [];
  if (oldTokens.length * newTokens.length > 120_000) {
    return [
      { value: before, kind: 'removed' },
      { value: after, kind: 'added' },
    ];
  }

  const lengths = Array.from({ length: oldTokens.length + 1 }, () => new Uint16Array(newTokens.length + 1));
  for (let oldIndex = oldTokens.length - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = newTokens.length - 1; newIndex >= 0; newIndex -= 1) {
      lengths[oldIndex][newIndex] = oldTokens[oldIndex] === newTokens[newIndex]
        ? lengths[oldIndex + 1][newIndex + 1] + 1
        : Math.max(lengths[oldIndex + 1][newIndex], lengths[oldIndex][newIndex + 1]);
    }
  }

  const parts: DiffPart[] = [];
  const push = (value: string, kind: DiffPart['kind']) => {
    const previous = parts.at(-1);
    if (previous?.kind === kind) previous.value += value;
    else parts.push({ value, kind });
  };
  let oldIndex = 0;
  let newIndex = 0;
  while (oldIndex < oldTokens.length && newIndex < newTokens.length) {
    if (oldTokens[oldIndex] === newTokens[newIndex]) {
      push(oldTokens[oldIndex], 'same');
      oldIndex += 1;
      newIndex += 1;
    } else if (lengths[oldIndex + 1][newIndex] >= lengths[oldIndex][newIndex + 1]) {
      push(oldTokens[oldIndex], 'removed');
      oldIndex += 1;
    } else {
      push(newTokens[newIndex], 'added');
      newIndex += 1;
    }
  }
  while (oldIndex < oldTokens.length) push(oldTokens[oldIndex++], 'removed');
  while (newIndex < newTokens.length) push(newTokens[newIndex++], 'added');
  return parts;
}

function DiffText({ parts, side, emptyText }: { parts: DiffPart[]; side: 'before' | 'after'; emptyText: string }) {
  const visible = parts.filter((part) => side === 'before' ? part.kind !== 'added' : part.kind !== 'removed');
  if (!visible.length) return <span className="italic text-muted-foreground">{emptyText}</span>;
  return visible.map((part, index) => {
    if (part.kind === 'same') return <span key={index}>{part.value}</span>;
    return (
      <mark
        key={index}
        className={cn(
          'rounded-sm px-0.5 py-0.5 text-inherit',
          part.kind === 'removed'
            ? 'bg-red-100 text-red-800 line-through decoration-red-500'
            : 'bg-emerald-100 text-emerald-900 underline decoration-emerald-500 decoration-2 underline-offset-2',
        )}
      >
        {part.value}
      </mark>
    );
  });
}

function SuggestionDiff({ sourceTexts, proposedText, operation }: { sourceTexts: string[]; proposedText: string; operation: ReturnType<typeof parseSuggestionSection>['operation'] }) {
  const before = operation === 'append'
    ? ''
    : sourceTexts.map((text, index) => operation === 'merge' ? `${index + 1}. ${text}` : text).join('\n');
  const after = proposedText.trim();
  const parts = useMemo(() => diffText(before, after), [after, before]);
  return (
    <section aria-label="修改前后对比">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-muted-foreground">前后差异</p>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground" aria-hidden="true">
          <span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm bg-red-200" />删除</span>
          <span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm bg-emerald-200" />新增</span>
        </div>
      </div>
      <div className="mt-2 grid overflow-hidden rounded-xl border bg-white md:grid-cols-2">
        <div className="border-b p-3.5 md:border-b-0 md:border-r">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-red-700">修改前</p>
          <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[#58657a]"><DiffText parts={parts} side="before" emptyText={operation === 'append' ? '原简历没有这条内容' : '无内容'} /></p>
        </div>
        <div className="bg-emerald-50/35 p-3.5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">修改后</p>
          <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[#354057]"><DiffText parts={parts} side="after" emptyText={operation === 'delete' ? '此条将从简历中删除' : '无内容'} /></p>
        </div>
      </div>
    </section>
  );
}

function Suggestion({
  suggestion,
  onChange,
  onDraft,
  current,
  total,
}: {
  suggestion: WorkspaceSuggestion;
  onChange: (updates: Partial<WorkspaceSuggestion>) => void;
  onDraft: (value: string) => void;
  current: number;
  total: number;
}) {
  const target = parseSuggestionSection(suggestion.sectionKey);
  const skillConfirmation = target.operation === 'append'
    && target.section === 'skills'
    && Boolean(suggestion.needsUserInput);
  const actionLabel = skillConfirmation
    ? '技能确认'
    : target.operation === 'append'
    ? '新增'
    : target.operation === 'delete'
      ? '删除'
      : target.operation === 'merge'
        ? '合并深化'
        : '改写';
  const sourceTexts = target.operation === 'merge'
    ? decodeMergeSourceTexts(suggestion.originalText)
    : suggestion.originalText
      ? [suggestion.originalText]
      : [];
  const savedText = suggestion.editedText || suggestion.proposedText;
  const [edit, setEdit] = useState(savedText);
  const [busy, setBusy] = useState<'' | 'accepted' | 'rejected'>('');
  const [actionError, setActionError] = useState('');
  const needsFact = Boolean(suggestion.needsUserInput) && edit.trim() === String(suggestion.proposedText || '').trim();
  const confirmLabel = skillConfirmation
    ? '我会，加入简历'
    : target.operation === 'append'
    ? '确认新增'
    : target.operation === 'merge'
      ? '确认合并'
    : target.operation === 'delete' && !edit.trim()
      ? '确认删除'
      : '接受改写';

  async function update(state: 'accepted' | 'rejected', confirmedByUser = false) {
    if (state === 'accepted' && needsFact && !confirmedByUser) {
      setActionError('这条建议缺少事实依据。请先补充真实内容，再点击接受。');
      return;
    }
    setBusy(state);
    setActionError('');
    try {
      const response = await fetch(`/api/suggestions/${suggestion.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ state, editedText: edit, confirmedByUser }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || '保存失败，请重试。');
      onChange({ state, editedText: edit });
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : '网络连接失败，请重试。');
    } finally {
      setBusy('');
    }
  }

  function editText(value: string) {
    setEdit(value);
    onDraft(value);
    setActionError('');
    if (suggestion.state === 'accepted') onChange({ state: 'pending' });
  }

  return (
    <article className="workspace-panel overflow-hidden">
      <header className="flex items-center justify-between border-b px-5 py-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">当前建议 {current} / {total}</p>
          <h3 className="mt-1 font-semibold">{actionLabel} · {target.label}</h3>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" disabled className="grid size-9 place-items-center rounded-lg border text-slate-300" aria-label="上一条建议"><ChevronLeft className="size-4" /></button>
          <button type="button" disabled className="grid size-9 place-items-center rounded-lg border text-slate-300" aria-label="下一条建议"><ChevronRight className="size-4" /></button>
        </div>
      </header>

      <div className="space-y-5 p-5">
        <section>
          <p className="text-xs font-semibold text-muted-foreground">{skillConfirmation ? '为什么询问' : '来自岗位要求'}</p>
          <p className="mt-2 rounded-lg border border-blue-200 bg-[#f5f8ff] px-3.5 py-3 text-sm leading-6 text-[#244579]">{suggestion.matchedRequirement}</p>
        </section>

        <SuggestionDiff sourceTexts={sourceTexts} proposedText={edit} operation={target.operation} />

        <section>
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={`suggestion-${suggestion.id}`} className="text-xs font-semibold text-muted-foreground">{skillConfirmation ? '确认后将加入技能栏（可编辑）' : target.operation === 'append' ? '新增要点（可编辑）' : target.operation === 'merge' ? '合并后的完整要点（可编辑）' : target.operation === 'delete' ? '删除后留空；填写内容则改写' : '建议改写（可编辑）'}</label>
            <span className="text-xs tabular-nums text-muted-foreground">{edit.length} 字</span>
          </div>
          <Textarea
            id={`suggestion-${suggestion.id}`}
            className="mt-2 min-h-36 border-primary/35 bg-white text-sm leading-7"
            value={edit}
            placeholder={target.operation === 'delete' ? '保持为空以删除；也可以填写“短标题：正文”改为合并后的内容' : '短标题：正文'}
            onChange={(event) => editText(event.target.value)}
          />
        </section>

        <details className="rounded-lg border">
          <summary className="cursor-pointer list-none px-3.5 py-3 text-sm font-medium text-[#465166] [&::-webkit-details-marker]:hidden">查看修改理由</summary>
          <p className="border-t px-3.5 py-3 text-sm leading-6 text-muted-foreground">{suggestion.rationale}</p>
        </details>

        {skillConfirmation ? <p className="callout-warning">现有资料没有这项技能。只有你点击“我会”后，它才会写进本次岗位简历。</p> : suggestion.needsUserInput ? <p className="callout-warning">这条内容需要你补充真实信息；编辑后即可接受。</p> : null}
        {actionError ? <p role="alert" className="text-sm text-red-700">{actionError}</p> : null}
      </div>

      <footer className="grid gap-2 border-t bg-[#fbfcfe] p-4 sm:grid-cols-[1fr_1.6fr]">
        <Button variant="outline" size="lg" disabled={Boolean(busy)} onClick={() => void update('rejected')}>
          <X />{busy === 'rejected' ? '保存中…' : skillConfirmation ? '不会，跳过' : '跳过'}
        </Button>
        <Button size="lg" disabled={Boolean(busy)} onClick={() => void update('accepted', skillConfirmation)}>
          <Check />{busy === 'accepted' ? '保存中…' : confirmLabel}
        </Button>
      </footer>
    </article>
  );
}

function LoadingFinal() {
  return (
    <section className="workspace-panel flex min-h-44 items-center justify-center p-6 text-center" aria-live="polite">
      <div>
        <LoaderCircle className="mx-auto size-7 animate-spin text-primary" />
        <p className="mt-4 font-semibold">正在生成岗位版简历</p>
        <p className="mt-1 text-sm text-muted-foreground">所有选择已确认，正在固化不可变版本。</p>
      </div>
    </section>
  );
}

function ExportReady({ version }: { version: { id: string; versionNumber: number } }) {
  return (
    <section className="overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-emerald-600 text-white"><Check className="size-5" /></span>
        <div>
          <h3 className="font-semibold text-emerald-950">岗位版简历已生成</h3>
          <p className="mt-1 text-sm leading-6 text-emerald-900">v{version.versionNumber} 已固化为不可变快照，可立即下载或之后重新导出。</p>
        </div>
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        <a data-interactive="true" className={buttonVariants({ size: 'lg' })} href={`/api/resume-versions/${version.id}/export?format=docx`}><FileDown />下载 DOCX</a>
        <a data-interactive="true" className={buttonVariants({ variant: 'outline', size: 'lg' })} target="_blank" rel="noreferrer" href={`/api/resume-versions/${version.id}/export?format=pdf`}><FileDown />打开 PDF</a>
        <OverleafCopyButton versionId={version.id} large className="w-full" />
      </div>
    </section>
  );
}

function Analysis({ analysis }: { analysis: JobAnalysis }) {
  const matchedFacts = analysis.matchedFacts || [];
  return (
    <div className="space-y-6">
      {matchedFacts.length ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="font-semibold text-emerald-950">事实库自动挑选</h3>
              <p className="mt-1 text-sm leading-6 text-emerald-900">从每段实习 / 工作经历的全部事实中，按这个 JD 选出最相关的内容；未选中的事实不会被删除。</p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-emerald-800">已选 {matchedFacts.length} 条</span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {matchedFacts.map((item, index) => (
              <div key={`${item.experienceIndex}-${item.fact}-${index}`} className="rounded-lg border border-emerald-200 bg-white px-3.5 py-3">
                <p className="text-xs font-semibold text-emerald-700">经历 {item.experienceIndex + 1} · {[item.organization, item.title].filter(Boolean).join(' · ') || '未命名经历'}</p>
                <p className="mt-1 text-sm leading-6 text-[#354057]">{item.fact}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <div className="rounded-lg border bg-[#f5f8ff] p-5">
        <p className="text-sm text-muted-foreground">当前匹配度</p>
        <p className="mt-3 text-5xl font-semibold tracking-[-0.05em] text-primary">{analysis.score}<span className="ml-1 text-lg">%</span></p>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-blue-100"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, analysis.score))}%` }} /></div>
      </div>
      <div>
        <p className="max-w-[75ch] leading-7 text-[#354057]">{analysis.summary}</p>
        <div className="mt-6 grid gap-x-6 gap-y-5 sm:grid-cols-2">
          <AnalysisList title="已有优势" items={analysis.strengths} tone="success" />
          <AnalysisList title="待补缺口" items={analysis.gaps} tone="warning" />
          <AnalysisList title="硬性要求" items={analysis.mustHave} />
          <AnalysisList title="关键词" items={analysis.keywords} />
        </div>
      </div>
      </div>
    </div>
  );
}

function AnalysisList({ title, items, tone = 'neutral' }: { title: string; items: string[]; tone?: 'neutral' | 'success' | 'warning' }) {
  return (
    <section>
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-2 divide-y rounded-lg border">
        {items.map((item, index) => (
          <li key={index} className="flex gap-2.5 px-3.5 py-2.5 text-sm leading-6 text-muted-foreground">
            <span className={cn('mt-2 status-dot', tone === 'success' ? 'bg-emerald-500' : tone === 'warning' ? 'bg-orange-500' : 'bg-primary')} />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function PackView({ pack }: { pack: ApplicationPackContent }) {
  const [copied, setCopied] = useState('');
  async function copy(id: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(id);
    window.setTimeout(() => setCopied(''), 1200);
  }
  return (
    <div className="space-y-6">
      {pack.missingFields.length ? <div className="callout-warning"><p className="font-medium">还缺少 {pack.missingFields.length} 项信息</p><p>{pack.missingFields.join('、')}</p></div> : null}
      {pack.groups.map((group) => (
        <section key={group.id}>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-medium">{group.title}</h3>
            <button type="button" onClick={() => void copy(group.id, group.fields.map((field) => `${field.label}：${field.value}`).join('\n'))} className="min-h-10 px-2 text-sm font-medium text-primary hover:underline">整组复制</button>
          </div>
          <div className="divide-y rounded-lg border">
            {group.fields.map((field) => (
              <div key={field.id} className="grid gap-2 p-4 sm:grid-cols-[150px_1fr_auto]">
                <div><p className="text-sm font-medium">{field.label}</p><p className="mt-1 text-xs text-muted-foreground">{field.source}</p></div>
                <p className={field.missing ? 'text-sm text-orange-700' : 'whitespace-pre-wrap text-sm leading-6'}>{field.missing ? '待补充' : field.value}<span className="ml-2 text-xs text-muted-foreground">{field.value.length} 字</span></p>
                <button type="button" disabled={field.missing} onClick={() => void copy(field.id, field.value)} className="min-h-10 px-2 text-sm font-medium text-primary disabled:text-slate-300"><Clipboard className="mr-1 inline size-4" />{copied === field.id ? '已复制' : '复制'}</button>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function CustomAnswer({ jobId, answers, onDone }: { jobId: string; answers: AnswerRecord[]; onDone: () => void }) {
  const [question, setQuestion] = useState('');
  const [limit, setLimit] = useState('300');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/jobs/${jobId}/custom-answers`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question, charLimit: limit ? Number(limit) : undefined }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || '生成失败，请重试。');
      setQuestion('');
      onDone();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '生成失败，请重试。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="临时开放题">
      <div className="grid gap-3 sm:grid-cols-[1fr_130px_auto]">
        <Input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="粘贴官网问题" aria-label="官网问题" />
        <Input value={limit} onChange={(event) => setLimit(event.target.value)} type="number" min="20" max="5000" aria-label="字数限制" />
        <Button onClick={() => void submit()} disabled={busy || question.trim().length < 3}>{busy ? '生成中…' : '生成答案'}</Button>
      </div>
      {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
      {answers.length ? (
        <div className="mt-5 divide-y rounded-lg border">
          {answers.map((answer) => (
            <div key={answer.id} className="p-4">
              <p className="font-medium">{answer.question}</p>
              <p className="mt-2 whitespace-pre-wrap leading-6 text-[#354057]">{answer.answer}</p>
              <button type="button" className="mt-3 min-h-10 text-sm font-medium text-primary" onClick={() => void navigator.clipboard.writeText(answer.answer)}>复制答案 · {answer.answer.length} 字{answer.charLimit ? ` / ${answer.charLimit}` : ''}</button>
            </div>
          ))}
        </div>
      ) : null}
    </Panel>
  );
}

function Empty({ text, action }: { text: string; action?: { href: string; label: string } }) {
  return (
    <div className="rounded-lg border border-dashed px-6 py-12 text-center text-sm leading-6 text-muted-foreground">
      <p>{text}</p>
      {action ? <AppLink href={action.href} className="mt-3 inline-flex min-h-10 items-center font-semibold text-primary hover:underline">{action.label}<ChevronRight className="size-4" /></AppLink> : null}
    </div>
  );
}
