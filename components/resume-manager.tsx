'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OverleafCopyButton } from '@/components/overleaf-copy-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ResumeRecord } from '@/lib/server/data';
type Version = { id:string; resumeId:string; jobId:string|null; versionNumber:number; createdAt:string; resumeName:string; language:'zh'|'en'; company:string|null; role:string|null };
function textFromPdfItems(items: Array<unknown>) {
  let output=''; let lastY:number|null=null;
  for(const raw of items){
    if(!raw||typeof raw!=='object'||!('str' in raw))continue;
    const item=raw as {str:string;transform?:number[];hasEOL?:boolean};
    const y=Array.isArray(item.transform)?Number(item.transform[5]):null;
    const changedLine=lastY!==null&&y!==null&&Math.abs(lastY-y)>2;
    if(changedLine&&!output.endsWith('\n'))output+='\n';
    else if(output&&!output.endsWith('\n')&&item.str&&!/^\s/.test(item.str))output+=' ';
    output+=item.str;
    if(item.hasEOL){output+='\n';lastY=null;}else if(y!==null)lastY=y;
  }
  return output;
}
export function ResumeManager({ resumes, versions }: { resumes: ResumeRecord[]; versions: Version[] }) {
  const router=useRouter(); const [file,setFile]=useState<File|null>(null); const [text,setText]=useState(''); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  async function choose(selected: File|null) { setFile(selected); setError(''); setText(''); if (!selected) return; try { if (selected.name.toLowerCase().endsWith('.docx')) { const mammoth=await import('mammoth/mammoth.browser'); const result=await mammoth.extractRawText({arrayBuffer:await selected.arrayBuffer()}); setText(result.value.trim()); } else if (selected.name.toLowerCase().endsWith('.pdf')) { const [,pdfjs]=await Promise.all([import('pdfjs-dist/build/pdf.worker.mjs'),import('pdfjs-dist')]); const loadingTask=pdfjs.getDocument({data:new Uint8Array(await selected.arrayBuffer())}); const doc=await loadingTask.promise; let output=''; for(let i=1;i<=doc.numPages;i++){ const page=await doc.getPage(i); const content=await page.getTextContent(); output += textFromPdfItems(content.items as Array<unknown>)+'\n'; } await loadingTask.destroy(); if(output.trim().length<30) throw new Error('这份 PDF 可能是图片扫描件，未提取到有效文字。请改传 DOCX 或粘贴可复制文本。'); setText(output.trim()); } else throw new Error('仅支持 PDF 或 DOCX。'); } catch(e){ setError(e instanceof Error?e.message:'解析失败，请改传 DOCX。'); } }
  async function submit(event:React.FormEvent<HTMLFormElement>){ event.preventDefault(); if(!file)return; setBusy(true);setError(''); const form=new FormData(event.currentTarget);form.set('file',file);form.set('extractedText',text);form.set('confirmed','true');const response=await fetch('/api/resume-imports',{method:'POST',body:form});const data=await response.json() as any;setBusy(false);if(!response.ok)return setError(data.error||'导入失败');setFile(null);setText('');router.refresh();}
  return <div className="space-y-6 pb-24"><form onSubmit={submit} className="rounded-2xl border bg-white p-5 sm:p-6"><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><UploadCloud className="size-5" /></span><div><h2 className="font-semibold">导入基础简历</h2><p className="mt-1 text-sm text-muted-foreground">浏览器本地提取文字，确认后才写入事实来源；原文件保存用于追溯。</p></div></div><div className="mt-5 grid gap-4 sm:grid-cols-[1fr_180px]"><div className="space-y-2"><Label htmlFor="name">简历名称</Label><Input id="name" name="name" required placeholder="例如：产品经理基础版" /></div><label className="space-y-2 text-sm font-medium">语言<select name="language" className="h-10 w-full rounded-lg border bg-white px-3 font-normal"><option value="zh">中文</option><option value="en">English</option></select></label></div><div className="mt-4"><Label htmlFor="resume-file">PDF / DOCX（最大 10MB）</Label><Input id="resume-file" className="mt-2" type="file" accept=".pdf,.docx" required onChange={(e)=>choose(e.target.files?.[0]||null)} /></div>{file ? <div className="mt-5 space-y-2"><div className="flex items-center justify-between"><Label htmlFor="resume-text">核对提取内容</Label><span className="text-xs text-muted-foreground">{text.length} 字</span></div><Textarea id="resume-text" value={text} onChange={(e)=>setText(e.target.value)} className="min-h-72 font-mono text-sm leading-6" /><p className="text-xs text-muted-foreground">请修正解析错误后再确认导入。此步骤不会自动改写你的经历。</p></div>:null}{error?<p role="alert" className="mt-4 text-sm text-destructive">{error}</p>:null}<div className="mt-5 flex justify-end"><Button type="submit" disabled={!file||text.trim().length<30||busy}>{busy?'正在导入…':'确认内容并导入'}</Button></div></form>
    <section><h2 className="mb-3 font-semibold">基础简历</h2>{resumes.length?<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{resumes.map((r)=><div key={r.id} className="rounded-2xl border bg-white p-5"><div className="flex items-start gap-3"><FileText className="mt-0.5 size-5 text-primary"/><div><p className="font-medium">{r.name}</p><p className="mt-1 text-xs text-muted-foreground">{r.language==='zh'?'中文':'English'} · {versions.filter(v=>v.resumeId===r.id).length} 个版本</p>{r.sourceFileId?<a className="mt-3 inline-block text-xs text-primary" href={`/api/files/${r.sourceFileId}`}>下载原文件</a>:null}</div></div></div>)}</div>:<p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">还没有简历，先导入一份 PDF 或 DOCX。</p>}</section>
    {versions.some(v=>v.jobId)?<section><h2 className="mb-3 font-semibold">岗位分支</h2><div className="grid gap-3 md:grid-cols-2">{versions.filter(v=>v.jobId).map(v=><div key={v.id} className="rounded-xl border bg-white p-4"><p className="font-medium">{v.company} · {v.role}</p><p className="mt-1 text-xs text-muted-foreground">{v.resumeName} v{v.versionNumber} · 不可变快照</p><div className="mt-3 flex flex-wrap items-center gap-2"><a href={`/api/resume-versions/${v.id}/export?format=docx`} className="text-sm text-primary">DOCX</a><a href={`/api/resume-versions/${v.id}/export?format=pdf`} target="_blank" className="text-sm text-primary">打印 PDF</a><OverleafCopyButton versionId={v.id}/></div></div>)}</div></section>:null}
  </div>;
}
