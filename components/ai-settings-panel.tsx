'use client';

import { useState } from 'react';
import { Check, Cpu, KeyRound, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AiSettings } from '@/lib/product-types';
import { cn } from '@/lib/utils';

const styles: Array<{ value: AiSettings['writingStyle']; title: string; text: string }> = [
  { value: 'concise', title: '精炼', text: '短句、高密度，适合快速投递' },
  { value: 'balanced', title: '平衡', text: '专业自然，兼顾细节与可读性' },
  { value: 'detailed', title: '完整', text: '保留更多背景和说明' },
];

export function AiSettingsPanel({
  initial,
  connection,
}: {
  initial: AiSettings;
  connection: { configured: boolean; model: string };
}) {
  const [settings, setSettings] = useState(initial);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState('');

  async function save() {
    setState('saving');
    setError('');
    const response = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(settings),
    });
    const data = await response.json() as { error?: string };
    if (!response.ok) {
      setError(data.error || '保存失败');
      setState('idle');
      return;
    }
    setState('saved');
    setTimeout(() => setState('idle'), 1600);
  }

  return (
    <div className="page-enter mx-auto max-w-6xl space-y-5 pb-24">
      <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[#071b2b] p-6 text-white shadow-[0_28px_90px_-45px_rgba(2,20,33,.8)] sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 flex items-center gap-2 text-sm text-cyan-200"><Sparkles className="size-4" /> AI ENGINE</div>
            <h2 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">让 AI 更懂你的投递节奏</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">模型只在服务端处理 JD、简历正文和必要事实。联系方式、证件号与详细地址会先被隐藏。</p>
          </div>
          <div className={cn('min-w-64 rounded-2xl border p-4 backdrop-blur', connection.configured ? 'border-emerald-300/20 bg-emerald-300/10' : 'border-amber-300/20 bg-amber-300/10')}>
            <div className="flex items-center gap-3">
              <span className={cn('grid size-10 place-items-center rounded-xl', connection.configured ? 'bg-emerald-300/15 text-emerald-200' : 'bg-amber-300/15 text-amber-200')}><KeyRound className="size-5" /></span>
              <div><p className="text-sm font-medium">{connection.configured ? 'AI 已连接' : '等待配置密钥'}</p><p className="mt-1 text-xs text-slate-300">{connection.model}</p></div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
        <section className="surface-card p-5 sm:p-6">
          <div className="flex items-center gap-3"><span className="icon-tile"><Cpu className="size-5" /></span><div><h2 className="font-semibold">生成偏好</h2><p className="mt-1 text-sm text-muted-foreground">影响岗位分析、简历建议和开放题答案。</p></div></div>

          <div className="mt-7 space-y-7">
            <fieldset><legend className="text-sm font-medium">表达风格</legend><div className="mt-3 grid gap-3 sm:grid-cols-3">{styles.map((item)=><button key={item.value} type="button" onClick={()=>setSettings(s=>({...s,writingStyle:item.value}))} className={cn('choice-card text-left',settings.writingStyle===item.value&&'choice-card-active')}><span className="flex items-center justify-between"><strong className="text-sm">{item.title}</strong>{settings.writingStyle===item.value?<Check className="size-4 text-primary"/>:null}</span><span className="mt-2 block text-xs leading-5 text-muted-foreground">{item.text}</span></button>)}</div></fieldset>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium">推理强度<select value={settings.reasoningEffort} onChange={e=>setSettings(s=>({...s,reasoningEffort:e.target.value as AiSettings['reasoningEffort']}))} className="premium-select"><option value="low">低 · 更快</option><option value="medium">中 · 更细致</option></select><span className="block text-xs font-normal text-muted-foreground">用于高频投递时，低推理通常更快。</span></label>
              <label className="space-y-2 text-sm font-medium">建议数量<select value={settings.suggestionLimit} onChange={e=>setSettings(s=>({...s,suggestionLimit:Number(e.target.value) as AiSettings['suggestionLimit']}))} className="premium-select"><option value="6">最多 6 条</option><option value="10">最多 10 条</option><option value="12">最多 12 条</option></select><span className="block text-xs font-normal text-muted-foreground">优先展示影响匹配度最大的修改。</span></label>
            </div>

            <label className="block space-y-2 text-sm font-medium">输出语言<select value={settings.outputLanguage} onChange={e=>setSettings(s=>({...s,outputLanguage:e.target.value as AiSettings['outputLanguage']}))} className="premium-select"><option value="auto">自动跟随 JD</option><option value="zh">优先中文</option><option value="en">Prefer English</option></select></label>
          </div>

          {error?<p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>:null}
          <div className="mt-7 flex justify-end"><Button size="lg" onClick={save} disabled={state==='saving'}>{state==='saving'?'保存中…':state==='saved'?'已保存设置':'保存 AI 设置'}</Button></div>
        </section>

        <div className="space-y-5">
          <section className="surface-card p-5 sm:p-6"><div className="flex items-center gap-3"><span className="icon-tile"><ShieldCheck className="size-5" /></span><h2 className="font-semibold">接入方式</h2></div><ol className="mt-5 space-y-4 text-sm leading-6 text-slate-600"><Step n="01" text="服务端读取 OPENAI_API_KEY，浏览器不会拿到密钥。"/><Step n="02" text="通过 Responses API 调用模型，默认使用 gpt-5.6-luna。"/><Step n="03" text="使用严格 JSON Schema 接收结果，格式异常会自动重试一次。"/><Step n="04" text="store: false，不把响应保存为可回取的 API 对象。"/></ol></section>
          <section className="surface-card p-5 sm:p-6"><div className="flex items-start gap-3"><span className="icon-tile"><LockKeyhole className="size-5" /></span><div><h2 className="font-semibold">事实边界</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">AI 只能调整已有事实的表达和顺序；证据不足时必须标记“待补充”，不会替你编造成果。</p></div></div></section>
        </div>
      </div>
    </div>
  );
}

function Step({ n, text }: { n: string; text: string }) { return <li className="flex gap-3"><span className="font-mono text-xs font-semibold text-primary">{n}</span><span>{text}</span></li>; }
