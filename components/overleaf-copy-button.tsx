'use client';

import { useState } from 'react';
import { Check, Clipboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

export function OverleafCopyButton({ versionId, large = false, className }: { versionId: string; large?: boolean; className?: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'copied' | 'error'>('idle');
  async function copy() {
    setState('loading');
    try {
      const response = await fetch(`/api/resume-versions/${versionId}/export?format=tex`);
      if (!response.ok) throw new Error('源码生成失败');
      await copyText(await response.text());
      setState('copied');
      window.setTimeout(() => setState('idle'), 2500);
    } catch {
      setState('error');
      window.setTimeout(() => setState('idle'), 2500);
    }
  }
  const label = state === 'loading' ? '正在生成…' : state === 'copied' ? '已复制源码' : state === 'error' ? '复制失败' : '复制 Overleaf';
  return <Button type="button" variant="outline" size={large ? 'lg' : 'sm'} className={cn(className)} onClick={copy} disabled={state === 'loading'} title="复制适配 resume.cls 模板的 main.tex 源码">{state === 'copied' ? <Check /> : <Clipboard />}{label}</Button>;
}
