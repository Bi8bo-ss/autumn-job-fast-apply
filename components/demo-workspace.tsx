'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  FileCheck2,
  LockKeyhole,
  MapPin,
  RefreshCcw,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import { AppLink } from '@/components/app-link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Stage = 'jd' | 'analysis' | 'tune' | 'pack' | 'pipeline';
type Decision = 'pending' | 'accepted' | 'rejected';

const stages: Array<{ id: Stage; label: string; short: string }> = [
  { id: 'jd', label: '岗位 JD', short: 'JD' },
  { id: 'analysis', label: '匹配分析', short: '匹配' },
  { id: 'tune', label: '定向改写', short: '改写' },
  { id: 'pack', label: '填写材料', short: '材料' },
  { id: 'pipeline', label: '投递跟踪', short: '投递' },
];

const demoJd = `用户增长数据分析实习生

岗位职责
1. 负责用户行为与增长数据分析，搭建核心指标体系并定位异常波动；
2. 使用 SQL、Python 完成数据处理，通过 Tableau / Power BI 搭建可视化看板；
3. 配合产品和运营团队开展专题分析、A/B Test，并推动结论落地。

岗位要求
熟练使用 SQL，有 Python 数据分析经验；了解互联网产品和游戏行业，具备清晰的业务表达能力。`;

const suggestions = [
  {
    id: 'rewrite',
    type: '修改' as const,
    section: '星河科技 · 数据分析实习生',
    label: '用户洞察',
    original: '使用 Python 清洗经营与用户数据，通过聚类分析提炼用户特征。',
    proposed: '使用 Python 清洗用户行为与经营数据，通过聚类分析识别高价值用户特征，并将分群结论转化为运营触达建议。',
    reason: '补齐“分析方法—用户洞察—业务动作”的完整链路，对应 JD 的用户行为分析与结论落地。',
  },
  {
    id: 'remove',
    type: '删除' as const,
    section: '校园项目',
    label: '内容取舍',
    original: '参与学院迎新活动，负责现场物料整理与人员引导。',
    proposed: '',
    reason: '与数据分析岗位关联较弱，删除后为更有证明力的项目成果留出一页空间。',
  },
  {
    id: 'skill',
    type: '新增' as const,
    section: '专业技能',
    label: '工具补充',
    original: 'SQL、Python、Power BI、Excel',
    proposed: 'SQL、Python、Tableau、Power BI、Excel',
    reason: 'JD 明确要求 Tableau。系统只提出确认，不会在你未确认掌握时直接写入。',
  },
];

const initialDecisions: Record<string, Decision> = {
  rewrite: 'pending',
  remove: 'pending',
  skill: 'pending',
};

export function DemoWorkspace() {
  const searchParams = useSearchParams();
  const [stage, setStage] = useState<Stage>('jd');
  const [decisions, setDecisions] = useState(initialDecisions);
  const [activeSuggestion, setActiveSuggestion] = useState('rewrite');
  const [copied, setCopied] = useState('');
  const [pipeline, setPipeline] = useState('待投递');

  const stageIndex = stages.findIndex((item) => item.id === stage);
  const accepted = useMemo(
    () => new Set(Object.entries(decisions).filter(([, value]) => value === 'accepted').map(([key]) => key)),
    [decisions],
  );

  function resetDemo() {
    setStage('jd');
    setDecisions(initialDecisions);
    setActiveSuggestion('rewrite');
    setCopied('');
    setPipeline('待投递');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function decide(id: string, value: Decision) {
    setDecisions((current) => ({ ...current, [id]: value }));
    const next = suggestions.find((item) => item.id !== id && decisions[item.id] === 'pending');
    if (next) setActiveSuggestion(next.id);
  }

  async function copyDemo(id: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(id);
      window.setTimeout(() => setCopied((current) => current === id ? '' : current), 1600);
    } catch {
      setCopied('');
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-[#172033]">
      <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/94 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1480px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#155eef] text-white shadow-[0_8px_20px_-10px_rgba(21,94,239,.8)]">
              <Target className="size-5" strokeWidth={2.3} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold">秋招速投</p>
              <p className="hidden text-xs text-slate-500 sm:block">岗位定向简历工作台</p>
            </div>
            <Badge variant="secondary" className="ml-1 h-6 rounded-md bg-[#eaf1ff] px-2 text-[#1748aa]">只读演示</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={resetDemo} className="hidden text-slate-600 sm:inline-flex">
              <RefreshCcw className="size-3.5" />重置
            </Button>
            <AppLink
              href="/"
              data-interactive="true"
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-[#155eef]/30 hover:bg-[#f7f9ff] hover:text-[#155eef]"
            >
              <LockKeyhole className="size-4" />
              <span className="hidden sm:inline">进入个人工作台</span>
              <span className="sm:hidden">登录</span>
            </AppLink>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1480px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        {searchParams.get('notice') === 'private' ? (
          <output className="mb-4 block rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm leading-6 text-orange-900">
            正式工作台仅向所有者开放，你可以在这里体验完整的只读流程。
          </output>
        ) : null}
        <section className="mb-5 flex flex-col gap-3 rounded-xl border border-[#bfd4ff] bg-[#edf3ff] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-white text-[#155eef]"><FileCheck2 className="size-4" /></span>
            <div>
              <p className="text-sm font-semibold text-[#153d88]">这是独立演示空间</p>
              <p className="mt-0.5 text-sm leading-6 text-[#42618f]">所有内容均为虚拟样例，操作不会保存，也不会调用 AI 或接触真实简历。</p>
            </div>
          </div>
          <p className="shrink-0 text-xs font-medium text-[#42618f]">约 2 分钟完成体验</p>
        </section>

        <section className="overflow-hidden rounded-xl border bg-white shadow-[0_1px_2px_rgba(23,32,51,.04)]">
          <div className="grid grid-cols-5 border-b" role="tablist" aria-label="演示流程">
            {stages.map((item, index) => {
              const active = item.id === stage;
              const complete = index < stageIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setStage(item.id)}
                  className={cn(
                    'group relative flex min-h-[66px] min-w-0 items-center justify-center gap-2 border-r px-1.5 text-sm font-semibold transition-colors last:border-r-0 sm:px-3',
                    active ? 'bg-[#f1f5ff] text-[#155eef]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800',
                  )}
                >
                  <span className={cn(
                    'grid size-7 shrink-0 place-items-center rounded-full border text-xs transition-colors',
                    active && 'border-[#155eef] bg-[#155eef] text-white',
                    complete && 'border-emerald-600 bg-emerald-600 text-white',
                  )}>{complete ? <Check className="size-4" /> : index + 1}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                  <span className="sm:hidden">{item.short}</span>
                  {active ? <span className="absolute inset-x-3 bottom-0 h-0.5 bg-[#155eef]" /> : null}
                </button>
              );
            })}
          </div>

          <div className="min-h-[640px] bg-[#f8faff] p-4 sm:p-6 lg:p-7">
            {stage === 'jd' ? <JdStage onNext={() => setStage('analysis')} /> : null}
            {stage === 'analysis' ? <AnalysisStage onNext={() => setStage('tune')} /> : null}
            {stage === 'tune' ? (
              <TuneStage
                decisions={decisions}
                accepted={accepted}
                activeSuggestion={activeSuggestion}
                onSelect={setActiveSuggestion}
                onDecide={decide}
                onNext={() => setStage('pack')}
              />
            ) : null}
            {stage === 'pack' ? <PackStage copied={copied} onCopy={copyDemo} onNext={() => setStage('pipeline')} /> : null}
            {stage === 'pipeline' ? <PipelineStage status={pipeline} onStatus={setPipeline} onReset={resetDemo} /> : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function StageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="mb-5">
      <p className="text-sm font-semibold text-[#155eef]">{eyebrow}</p>
      <h1 className="mt-2 text-xl font-semibold tracking-[-0.025em] sm:text-2xl">{title}</h1>
      <p className="mt-2 max-w-3xl text-[15px] leading-7 text-slate-600">{description}</p>
    </div>
  );
}

function JdStage({ onNext }: { onNext: () => void }) {
  return (
    <div className="mx-auto max-w-[1060px]">
      <StageHeading eyebrow="第一步" title="粘贴 JD，岗位信息能填则填" description="公司和岗位名称优先采用手动填写；留空时再从 JD 中识别，并匹配最合适的原版简历。" />
      <div className="grid gap-4 lg:grid-cols-[310px_minmax(0,1fr)]">
        <div className="rounded-xl border bg-white p-5">
          <label htmlFor="demo-company" className="block text-sm font-medium text-slate-700">公司名称</label>
          <input id="demo-company" readOnly value="云图互动" className="mt-2 h-11 w-full rounded-lg border bg-white px-3 text-sm outline-none" />
          <label htmlFor="demo-role" className="mt-4 block text-sm font-medium text-slate-700">岗位名称</label>
          <input id="demo-role" readOnly value="用户增长数据分析实习生" className="mt-2 h-11 w-full rounded-lg border bg-white px-3 text-sm outline-none" />
          <p className="mt-4 block text-sm font-medium text-slate-700">基础简历</p>
          <div className="mt-2 flex min-h-11 items-center justify-between rounded-lg border bg-[#f8faff] px-3 text-sm">
            <span className="font-medium">数据分析 · 中文 v3</span>
            <CheckCircle2 className="size-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">匹配理由：经历中包含 SQL、用户分析和可视化项目。</p>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <div className="flex items-center justify-between">
            <label htmlFor="demo-jd" className="text-sm font-semibold">岗位描述</label>
            <span className="text-xs text-slate-500">已识别 8 个要求</span>
          </div>
          <textarea id="demo-jd" readOnly value={demoJd} className="mt-3 min-h-[350px] w-full resize-none rounded-lg border bg-white p-4 text-[15px] leading-7 outline-none" />
          <div className="mt-4 flex justify-end">
            <Button size="lg" onClick={onNext} className="bg-[#155eef] hover:bg-[#0f52d5]">开始匹配分析<ArrowRight /></Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalysisStage({ onNext }: { onNext: () => void }) {
  const groups = [
    { label: '优势', tone: 'green', values: ['SQL 与 Python 数据处理', '用户分群与经营分析', '跨团队推动结论落地'] },
    { label: '待确认', tone: 'orange', values: ['是否熟练使用 Tableau', '是否有游戏行业关注或项目'] },
  ];
  return (
    <div className="mx-auto max-w-[1060px]">
      <StageHeading eyebrow="匹配分析" title="先看证据，再决定怎么改" description="系统拆解硬性要求、关键词和缺口；没有事实依据的内容只会向你确认，不会直接写进简历。" />
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm font-semibold">综合匹配度</p>
          <div className="mt-5 flex items-end gap-2"><span className="text-5xl font-semibold tracking-[-0.06em] text-[#155eef]">87</span><span className="pb-1 text-sm text-slate-500">/ 100</span></div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-[87%] rounded-full bg-[#155eef]" /></div>
          <p className="mt-4 text-sm leading-6 text-slate-600">核心方法和工具匹配度高。补充 Tableau 与行业兴趣后，表达会更贴近岗位。</p>
        </div>
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.label} className="rounded-xl border bg-white p-5">
              <div className="flex items-center gap-2"><span className={cn('size-2 rounded-full', group.tone === 'green' ? 'bg-emerald-500' : 'bg-orange-500')} /><h2 className="font-semibold">{group.label}</h2></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {group.values.map((value) => <div key={value} className="rounded-lg border bg-[#fafbfc] px-3.5 py-3 text-sm leading-6 text-slate-700">{value}</div>)}
              </div>
            </div>
          ))}
          <div className="rounded-xl border bg-white p-5">
            <h2 className="font-semibold">JD 高频关键词</h2>
            <div className="mt-3 flex flex-wrap gap-2">{['用户行为', '增长分析', 'SQL', 'Python', 'Tableau', 'A/B Test', '业务落地'].map((word) => <Badge key={word} variant="outline" className="h-7 rounded-md bg-white px-2.5 text-slate-600">{word}</Badge>)}</div>
          </div>
        </div>
      </div>
      <div className="mt-5 flex justify-end"><Button size="lg" onClick={onNext} className="bg-[#155eef] hover:bg-[#0f52d5]">查看修改建议<ChevronRight /></Button></div>
    </div>
  );
}

function TuneStage({ decisions, accepted, activeSuggestion, onSelect, onDecide, onNext }: {
  decisions: Record<string, Decision>;
  accepted: Set<string>;
  activeSuggestion: string;
  onSelect: (id: string) => void;
  onDecide: (id: string, value: Decision) => void;
  onNext: () => void;
}) {
  const current = suggestions.find((item) => item.id === activeSuggestion) || suggestions[0];
  const processed = Object.values(decisions).filter((value) => value !== 'pending').length;
  return (
    <div>
      <StageHeading eyebrow="定向改写" title="左侧实时预览，右侧逐条确认" description="所有建议都基于原版简历。可修改、删除或新增；绿色标出新增内容，红色标出待删除内容。" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(390px,.85fr)]">
        <ResumePreview accepted={accepted} activeId={activeSuggestion} />
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border bg-white px-4 py-3">
            <div><p className="text-sm font-semibold">修改建议</p><p className="mt-0.5 text-xs text-slate-500">已处理 {processed} / {suggestions.length}</p></div>
            <div className="flex gap-1.5">{suggestions.map((item, index) => <button key={item.id} type="button" aria-label={`查看建议 ${index + 1}`} onClick={() => onSelect(item.id)} className={cn('grid size-8 place-items-center rounded-lg border text-xs font-semibold', activeSuggestion === item.id ? 'border-[#155eef] bg-[#edf3ff] text-[#155eef]' : decisions[item.id] === 'accepted' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : decisions[item.id] === 'rejected' ? 'bg-slate-100 text-slate-500' : 'bg-white text-slate-600')}>{decisions[item.id] === 'accepted' ? <Check className="size-4" /> : index + 1}</button>)}</div>
          </div>
          <div className="rounded-xl border bg-white p-5 shadow-[0_10px_30px_-24px_rgba(15,23,42,.35)]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2"><Badge variant="outline" className={cn('h-6 rounded-md', current.type === '删除' && 'border-red-200 bg-red-50 text-red-700', current.type === '新增' && 'border-emerald-200 bg-emerald-50 text-emerald-700')}>{current.type}</Badge><span className="text-sm font-semibold">{current.section}</span></div>
              <span className="text-xs text-slate-500">{current.label}</span>
            </div>
            <div className="mt-5 space-y-3">
              <DiffBlock label="原文" tone="old" value={current.original} />
              {current.proposed ? <DiffBlock label="建议" tone="new" value={current.proposed} /> : <div className="rounded-lg border border-dashed border-red-200 bg-red-50/60 p-4 text-sm text-red-700"><Trash2 className="mr-2 inline size-4" />建议删除整条低相关内容</div>}
            </div>
            <div className="mt-4 rounded-lg bg-[#f6f8fb] p-4">
              <p className="text-xs font-semibold text-slate-500">为什么这样改</p>
              <p className="mt-1.5 text-sm leading-6 text-slate-700">{current.reason}</p>
            </div>
            {current.id === 'skill' ? <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm leading-6 text-orange-900"><strong>需要你确认：</strong>我确实会使用 Tableau，并能在面试中说明使用经验。</div> : null}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Button variant="outline" size="lg" onClick={() => onDecide(current.id, 'rejected')}><X />不采用</Button>
              <Button size="lg" onClick={() => onDecide(current.id, 'accepted')}><Check />{decisions[current.id] === 'accepted' ? '已采用' : '采用修改'}</Button>
            </div>
          </div>
          <Button size="lg" onClick={onNext} className="w-full bg-[#155eef] hover:bg-[#0f52d5]">生成投递材料<ArrowRight /></Button>
        </div>
      </div>
    </div>
  );
}

function ResumePreview({ accepted, activeId }: { accepted: Set<string>; activeId: string }) {
  const rewrite = accepted.has('rewrite');
  const remove = accepted.has('remove');
  const skill = accepted.has('skill');
  return (
    <div className="overflow-auto rounded-xl border bg-[#e8edf4] p-3 sm:p-5">
      <article className="mx-auto min-h-[680px] max-w-[720px] bg-white px-7 py-7 text-[12px] leading-[1.55] text-black shadow-[0_8px_30px_-18px_rgba(15,23,42,.4)] sm:px-10">
        <div className="border-b-2 border-black pb-3 text-center"><h2 className="text-xl font-bold tracking-[.18em]">林 晴</h2><p className="mt-1.5">138****1024 · linqing@example.com · 上海</p></div>
        <ResumeSection title="教育背景"><ResumeHeading title="海城大学 · 信息管理与信息系统" meta="2022.09 – 2026.06" /><p>本科 · GPA 3.7/4.0 · 主修课程：数据分析、数据库系统、商业统计</p></ResumeSection>
        <ResumeSection title="实习经历">
          <ResumeHeading title="星河科技 · 数据分析实习生" meta="2025.06 – 2025.09" />
          <ResumeBullet label="数据处理">编写 SQL 脚本整合多源业务数据，完成口径核验与日常指标监控。</ResumeBullet>
          <div className={cn(activeId === 'rewrite' && 'rounded bg-amber-50 ring-2 ring-amber-200')}>
            <ResumeBullet label="用户洞察" changed={rewrite}>{rewrite ? '使用 Python 清洗用户行为与经营数据，通过聚类分析识别高价值用户特征，并将分群结论转化为运营触达建议。' : '使用 Python 清洗经营与用户数据，通过聚类分析提炼用户特征。'}</ResumeBullet>
          </div>
          <ResumeBullet label="看板建设">使用 Power BI 搭建经营看板，支持产品与运营团队快速定位指标波动。</ResumeBullet>
        </ResumeSection>
        <ResumeSection title="项目经历">
          <ResumeHeading title="电商转化漏斗 A/B Test" meta="2025.10 – 2025.12" />
          <ResumeBullet label="实验分析">设计分流与指标口径，使用 Python 完成显著性检验，识别影响转化率的关键页面并输出迭代建议。</ResumeBullet>
          {!remove ? <div className={cn(activeId === 'remove' && 'rounded bg-red-50 ring-2 ring-red-200')}><ResumeBullet label="校园活动" removed={activeId === 'remove'}>参与学院迎新活动，负责现场物料整理与人员引导。</ResumeBullet></div> : null}
        </ResumeSection>
        <ResumeSection title="专业技能">
          <div className={cn(activeId === 'skill' && 'rounded bg-amber-50 ring-2 ring-amber-200')}>
            <p><strong>方法与工具：</strong>SQL、Python、{skill ? <mark className="rounded bg-emerald-100 px-0.5 text-emerald-950">Tableau、</mark> : null}Power BI、Excel</p>
          </div>
          <p><strong>业务分析：</strong>用户行为分析、指标体系、A/B Test、数据可视化</p>
          <p><strong>语言能力：</strong>中文（母语）、英语（可作为工作语言）</p>
        </ResumeSection>
      </article>
    </div>
  );
}

function ResumeSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-3"><h3 className="mb-1.5 border-b border-black pb-0.5 text-[14px] font-bold">{title}</h3><div className="space-y-1">{children}</div></section>;
}

function ResumeHeading({ title, meta }: { title: string; meta: string }) {
  return <div className="flex items-start justify-between gap-4 font-bold"><p>{title}</p><p className="shrink-0">{meta}</p></div>;
}

function ResumeBullet({ label, changed, removed, children }: { label: string; changed?: boolean; removed?: boolean; children: React.ReactNode }) {
  return <p className={cn('pl-3 before:absolute before:-ml-3 before:content-["•"]', changed && 'bg-emerald-50 text-emerald-950', removed && 'text-red-800 line-through decoration-red-400')}><strong>{label}：</strong>{children}</p>;
}

function DiffBlock({ label, tone, value }: { label: string; tone: 'old' | 'new'; value: string }) {
  return <div className={cn('rounded-lg border p-4', tone === 'old' ? 'border-red-100 bg-red-50/60' : 'border-emerald-100 bg-emerald-50/70')}><p className={cn('text-xs font-semibold', tone === 'old' ? 'text-red-700' : 'text-emerald-700')}>{label}</p><p className="mt-1.5 text-sm leading-6 text-slate-800">{value}</p></div>;
}

function PackStage({ copied, onCopy, onNext }: { copied: string; onCopy: (id: string, value: string) => void; onNext: () => void }) {
  const fields = [
    { id: 'name', label: '姓名', value: '林晴' },
    { id: 'school', label: '学校与专业', value: '海城大学 · 信息管理与信息系统' },
    { id: 'skills', label: '技能概览', value: 'SQL、Python、Power BI、A/B Test、用户行为分析' },
  ];
  const intro = '我是一名信息管理专业应届生，具备 SQL、Python 数据处理和用户行为分析经验。曾通过指标体系与可视化看板定位业务波动，并将用户分群结论转化为运营建议。希望在用户增长分析岗位继续用数据支持产品决策。';
  return (
    <div className="mx-auto max-w-[1060px]">
      <StageHeading eyebrow="填写材料" title="官网字段和自我介绍一次准备好" description="内容来自事实库、已确认简历和 JD；缺少的信息会提示补充，不会由 AI 猜测。" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded-xl border bg-white">
          <div className="border-b px-5 py-4"><h2 className="font-semibold">个人与经历信息</h2><p className="mt-1 text-sm text-slate-500">可按字段复制到招聘官网</p></div>
          <div className="divide-y">
            {fields.map((field) => <div key={field.id} className="flex items-center gap-4 px-5 py-4"><div className="min-w-0 flex-1"><p className="text-xs font-medium text-slate-500">{field.label}</p><p className="mt-1 truncate text-sm text-slate-800">{field.value}</p></div><Button variant="ghost" size="sm" onClick={() => onCopy(field.id, field.value)}>{copied === field.id ? <Check className="text-emerald-600" /> : <Clipboard />}<span className="hidden sm:inline">{copied === field.id ? '已复制' : '复制'}</span></Button></div>)}
          </div>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <div className="flex items-center justify-between"><h2 className="font-semibold">自我介绍</h2><span className="text-xs text-slate-500">92 / 150 字</span></div>
          <p className="mt-4 rounded-lg border bg-[#fafbfc] p-4 text-sm leading-7 text-slate-700">{intro}</p>
          <Button variant="outline" className="mt-4 w-full" onClick={() => onCopy('intro', intro)}>{copied === 'intro' ? <Check className="text-emerald-600" /> : <Clipboard />}{copied === 'intro' ? '已复制' : '复制自我介绍'}</Button>
          <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900"><strong>还缺 1 项：</strong>最快到岗时间</div>
        </div>
      </div>
      <div className="mt-5 flex justify-end"><Button size="lg" onClick={onNext} className="bg-[#155eef] hover:bg-[#0f52d5]">加入投递看板<ArrowRight /></Button></div>
    </div>
  );
}

function PipelineStage({ status, onStatus, onReset }: { status: string; onStatus: (value: string) => void; onReset: () => void }) {
  const columns = ['待投递', '已投递', '笔试', '面试', 'Offer'];
  return (
    <div className="mx-auto max-w-[1160px]">
      <StageHeading eyebrow="投递跟踪" title="从待投递一直跟到 Offer" description="选择一个阶段，体验岗位卡片如何在看板中更新。演示状态仅保存在当前页面。" />
      <div className="grid gap-3 sm:grid-cols-5">
        {columns.map((column) => <button key={column} type="button" onClick={() => onStatus(column)} className={cn('min-h-[220px] rounded-xl border p-3 text-left transition-all', status === column ? 'border-[#155eef]/35 bg-[#edf3ff] ring-2 ring-[#155eef]/10' : 'bg-[#f5f7fa] hover:border-slate-300')}><div className="flex items-center justify-between"><p className="text-sm font-semibold">{column}</p><span className="grid size-6 place-items-center rounded-md bg-white text-xs font-semibold text-slate-500">{status === column ? 1 : 0}</span></div>{status === column ? <div className="mt-3 rounded-lg border bg-white p-3.5 shadow-[0_5px_18px_-14px_rgba(15,23,42,.45)]"><div className="flex items-center gap-2 text-xs text-[#155eef]"><BriefcaseBusiness className="size-3.5" />当前岗位</div><p className="mt-2 text-sm font-semibold">云图互动</p><p className="mt-1 text-xs leading-5 text-slate-500">用户增长数据分析实习生</p><div className="mt-3 flex items-center gap-1 text-xs text-slate-500"><MapPin className="size-3.5" />上海</div></div> : null}</button>)}
      </div>
      <div className="mt-6 flex flex-col items-center rounded-xl border bg-white px-5 py-7 text-center">
        <span className="grid size-11 place-items-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 className="size-6" /></span>
        <h2 className="mt-3 text-lg font-semibold">演示完成</h2>
        <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">真实工作台会保存每个岗位的简历版本、材料包和投递状态，并确保不同用户的数据相互隔离。</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3"><Button variant="outline" onClick={onReset}><RefreshCcw />重新体验</Button><AppLink href="/" data-interactive="true" className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#155eef] px-4 text-sm font-semibold text-white transition hover:bg-[#0f52d5]"><LockKeyhole className="size-4" />进入个人工作台</AppLink></div>
      </div>
    </div>
  );
}
