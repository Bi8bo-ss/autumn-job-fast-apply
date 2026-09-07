'use client';

import { useState } from 'react';
import { Check, ChevronDown, Cpu, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
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
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || '保存失败，请重试。');
      setState('saved');
      window.setTimeout(() => setState('idle'), 1600);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败，请重试。');
      setState('idle');
    }
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-5">
      <section className="workspace-panel grid overflow-hidden md:grid-cols-3">
        <StatusItem icon={KeyRound} title={connection.configured ? 'AI 已连接' : 'AI 尚未连接'} text={connection.configured ? '岗位分析与生成能力可用' : '需要先在服务端配置密钥'} tone={connection.configured ? 'success' : 'warning'} />
        <StatusItem icon={ShieldCheck} title="隐私处理已启用" text="联系方式、证件号与详细地址会被隐藏" />
        <StatusItem icon={LockKeyhole} title="事实边界" text="只调整已有事实，不编造成果" />
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_310px]">
        <section className="workspace-panel p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#edf3ff] text-primary"><Cpu className="size-5" /></span>
            <div>
              <h2 className="font-semibold">生成偏好</h2>
              <p className="mt-1 text-sm text-muted-foreground">影响岗位分析、简历建议和开放题答案。</p>
            </div>
          </div>

          <div className="mt-7 space-y-7">
            <fieldset>
              <legend className="text-sm font-medium">表达风格</legend>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {styles.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setSettings((current) => ({ ...current, writingStyle: item.value }))}
                    className={cn('choice-card min-h-[108px]', settings.writingStyle === item.value && 'choice-card-active')}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <strong className="text-sm">{item.title}</strong>
                      {settings.writingStyle === item.value ? <Check className="size-4 text-primary" /> : null}
                    </span>
                    <span className="mt-2 block text-xs leading-5 text-muted-foreground">{item.text}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium">
                推理强度
                <select value={settings.reasoningEffort} onChange={(event) => setSettings((current) => ({ ...current, reasoningEffort: event.target.value as AiSettings['reasoningEffort'] }))} className="premium-select">
                  <option value="low">低 · 更快</option>
                  <option value="medium">中 · 更细致</option>
                </select>
                <span className="block text-xs font-normal leading-5 text-muted-foreground">高频投递可选择“低”，重要岗位建议选择“中”。</span>
              </label>
              <label className="space-y-2 text-sm font-medium">
                建议数量
                <select value={settings.suggestionLimit} onChange={(event) => setSettings((current) => ({ ...current, suggestionLimit: Number(event.target.value) as AiSettings['suggestionLimit'] }))} className="premium-select">
                  <option value="6">最多 6 条</option>
                  <option value="10">最多 10 条</option>
                  <option value="12">最多 12 条</option>
                </select>
                <span className="block text-xs font-normal leading-5 text-muted-foreground">优先展示最影响匹配的修改。</span>
              </label>
            </div>

            <label className="block space-y-2 text-sm font-medium">
              输出语言
              <select value={settings.outputLanguage} onChange={(event) => setSettings((current) => ({ ...current, outputLanguage: event.target.value as AiSettings['outputLanguage'] }))} className="premium-select">
                <option value="auto">自动跟随 JD</option>
                <option value="zh">优先中文</option>
                <option value="en">Prefer English</option>
              </select>
            </label>
          </div>

          {error ? <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}
          <div className="mt-7 flex justify-end">
            <Button size="lg" onClick={save} disabled={state === 'saving'}>
              {state === 'saved' ? <Check /> : null}
              {state === 'saving' ? '保存中…' : state === 'saved' ? '设置已保存' : '保存 AI 设置'}
            </Button>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="workspace-panel p-5">
            <h2 className="font-semibold">当前模型</h2>
            <p className="mt-2 break-all text-sm text-muted-foreground">{connection.model}</p>
            <p className="mt-4 text-sm leading-6 text-[#58657a]">模型只接收完成当前任务所需的 JD、简历正文和必要事实。</p>
          </section>

          <details className="group workspace-panel overflow-hidden">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-5 text-sm font-semibold [&::-webkit-details-marker]:hidden">
              连接详情
              <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t px-5 py-4 text-xs leading-6 text-muted-foreground">
              <p>密钥仅由服务端读取，浏览器无法访问。</p>
              <p className="mt-2">使用 Responses API 与结构化响应；请求不会保存为可回取对象。</p>
            </div>
          </details>
        </aside>
      </div>
    </div>
  );
}

function StatusItem({
  icon: Icon,
  title,
  text,
  tone = 'neutral',
}: {
  icon: typeof KeyRound;
  title: string;
  text: string;
  tone?: 'neutral' | 'success' | 'warning';
}) {
  return (
    <div className="flex gap-3 border-b p-5 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
      <span className={cn(
        'grid size-9 shrink-0 place-items-center rounded-lg',
        tone === 'success' && 'bg-emerald-50 text-emerald-700',
        tone === 'warning' && 'bg-orange-50 text-orange-700',
        tone === 'neutral' && 'bg-[#edf3ff] text-primary',
      )}><Icon className="size-4" /></span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}
