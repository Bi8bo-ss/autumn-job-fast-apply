'use client';

import { useState, type SubmitEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Check, FileCheck2, FileText, LoaderCircle, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OverleafCopyButton } from '@/components/overleaf-copy-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ResumeRecord } from '@/lib/server/data';
import { textFromPdfItems } from '@/lib/resume-pdf';

type Version = {
  id: string;
  resumeId: string;
  jobId: string | null;
  versionNumber: number;
  createdAt: string;
  resumeName: string;
  language: 'zh' | 'en';
  company: string | null;
  role: string | null;
};

type ImportResponse = { error?: string };

export function ResumeManager({ resumes, versions }: { resumes: ResumeRecord[]; versions: Version[] }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');

  async function choose(selected: File | null) {
    setFile(selected);
    setError('');
    setText('');
    if (!selected) return;
    setParsing(true);
    try {
      if (selected.name.toLowerCase().endsWith('.docx')) {
        const mammoth = await import('mammoth/mammoth.browser');
        const result = await mammoth.extractRawText({ arrayBuffer: await selected.arrayBuffer() });
        setText(result.value.trim());
      } else if (selected.name.toLowerCase().endsWith('.pdf')) {
        const [, pdfjs] = await Promise.all([import('pdfjs-dist/build/pdf.worker.mjs'), import('pdfjs-dist')]);
        const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await selected.arrayBuffer()) });
        const doc = await loadingTask.promise;
        let output = '';
        for (let index = 1; index <= doc.numPages; index++) {
          const page = await doc.getPage(index);
          const content = await page.getTextContent();
          output += textFromPdfItems(content.items, page.getViewport({ scale: 1 }).transform) + '\n';
        }
        await loadingTask.destroy();
        if (output.trim().length < 30) throw new Error('这份 PDF 可能是图片扫描件，未提取到有效文字。请改传 DOCX 或可复制文本。');
        setText(output.trim());
      } else {
        throw new Error('仅支持 PDF 或 DOCX。');
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '解析失败，请改传 DOCX。');
    } finally {
      setParsing(false);
    }
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const form = new FormData(event.currentTarget);
      form.set('file', file);
      form.set('extractedText', text);
      form.set('confirmed', 'true');
      const response = await fetch('/api/resume-imports', { method: 'POST', body: form });
      const data = await response.json() as ImportResponse;
      if (!response.ok) throw new Error(data.error || '导入失败，请重试。');
      setFile(null);
      setText('');
      event.currentTarget.reset();
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '导入失败，请重试。');
    } finally {
      setBusy(false);
    }
  }

  const branchVersions = versions.filter((version) => version.jobId);

  return (
    <div className="mx-auto max-w-[1240px] space-y-6">
      <section className="workspace-panel overflow-hidden">
        <div className="grid lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="border-b bg-[#f8faff] p-5 lg:border-b-0 lg:border-r sm:p-6">
            <UploadCloud className="size-6 text-primary" />
            <h2 className="mt-4 text-lg font-semibold">导入基础简历</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">文件先在浏览器中解析。确认文字无误后，才会保存为事实来源。</p>
            <ol className="mt-6 space-y-4 text-sm">
              {['选择 PDF 或 DOCX', '核对提取内容', '确认导入'].map((label, index) => (
                <li key={label} className="flex items-center gap-3">
                  <span className="grid size-6 place-items-center rounded-full border bg-white text-xs font-semibold text-primary">{index + 1}</span>
                  {label}
                </li>
              ))}
            </ol>
          </div>

          <form onSubmit={submit} className="p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
              <div className="space-y-2">
                <Label htmlFor="resume-name">简历名称</Label>
                <Input id="resume-name" name="name" required placeholder="例如：数据分析基础版" />
              </div>
              <label className="space-y-2 text-sm font-medium text-[#354057]">
                语言
                <select name="language" className="h-10 w-full rounded-lg border bg-white px-3 font-normal">
                  <option value="zh">中文</option>
                  <option value="en">English</option>
                </select>
              </label>
            </div>

            <div className="mt-4">
              <Label htmlFor="resume-file">简历文件（最大 10MB）</Label>
              <Input id="resume-file" className="mt-2 h-11" type="file" accept=".pdf,.docx" required onChange={(event) => void choose(event.target.files?.[0] || null)} />
            </div>

            {parsing ? (
              <div aria-live="polite" className="mt-5 flex items-center gap-3 rounded-lg border bg-slate-50 px-4 py-4 text-sm">
                <LoaderCircle className="size-4 animate-spin text-primary" />
                正在解析文件内容…
              </div>
            ) : null}

            {file && !parsing ? (
              <div className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="resume-text">核对提取内容</Label>
                  <span className="text-xs text-muted-foreground">{text.length} 字</span>
                </div>
                <Textarea id="resume-text" value={text} onChange={(event) => setText(event.target.value)} className="mt-2 min-h-72 text-sm leading-6" />
                <p className="mt-2 text-xs leading-5 text-muted-foreground">修正解析错误后再导入。系统不会在这一步自动改写经历。</p>
              </div>
            ) : null}

            {error ? <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}
            <div className="mt-5 flex justify-end">
              <Button type="submit" disabled={!file || text.trim().length < 30 || busy || parsing}>
                {busy ? <LoaderCircle className="animate-spin" /> : <FileCheck2 />}
                {busy ? '正在导入…' : '确认并导入'}
              </Button>
            </div>
          </form>
        </div>
      </section>

      <section className="workspace-panel overflow-hidden">
        <div className="border-b px-5 py-4 sm:px-6">
          <h2 className="font-semibold">基础简历</h2>
          <p className="mt-1 text-sm text-muted-foreground">每个岗位版本都会追溯到这里的事实来源。</p>
        </div>
        {resumes.length ? (
          <div className="divide-y">
            {resumes.map((resume) => (
              <div key={resume.id} className="grid gap-4 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_140px_auto] sm:items-center sm:px-6">
                <div className="flex min-w-0 items-start gap-3">
                  <FileText className="mt-0.5 size-5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{resume.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">创建于 {new Date(resume.createdAt).toLocaleDateString('zh-CN')}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{resume.language === 'zh' ? '中文' : 'English'} · {versions.filter((version) => version.resumeId === resume.id).length} 个版本</p>
                {resume.sourceFileId ? <a className="text-sm font-medium text-primary hover:underline" href={`/api/files/${resume.sourceFileId}`}>下载原文件</a> : <span className="text-sm text-muted-foreground">无原文件</span>}
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">还没有基础简历，先在上方导入一份文件。</div>
        )}
      </section>

      {branchVersions.length ? (
        <section className="workspace-panel overflow-hidden">
          <div className="border-b px-5 py-4 sm:px-6">
            <h2 className="font-semibold">岗位定向版本</h2>
            <p className="mt-1 text-sm text-muted-foreground">已固化的快照可以随时重复导出。</p>
          </div>
          <div className="divide-y">
            {branchVersions.map((version) => (
              <div key={version.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_180px_auto] lg:items-center sm:px-6">
                <div className="flex min-w-0 items-start gap-3">
                  <Check className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{version.company || '公司未识别'} · {version.role || '岗位未识别'}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{version.resumeName} v{version.versionNumber} · 不可变快照</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{new Date(version.createdAt).toLocaleString('zh-CN')}</p>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <a href={`/api/resume-versions/${version.id}/export?format=docx`} className="font-medium text-primary hover:underline">DOCX</a>
                  <a href={`/api/resume-versions/${version.id}/export?format=pdf`} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">PDF</a>
                  <OverleafCopyButton versionId={version.id} />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
