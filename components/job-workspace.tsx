'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Clipboard, FileDown, Sparkles, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { jobStatusLabels, jobStatuses, type ApplicationPackContent, type JobAnalysis } from '@/lib/product-types';

type Data = any;
type WorkspaceTab = 'job' | 'analysis' | 'tune' | 'pack' | 'exports';
const workspaceTabs: Array<{ id: WorkspaceTab; label: string }> = [
  { id: 'job', label: '岗位信息' },
  { id: 'analysis', label: 'JD 分析' },
  { id: 'tune', label: '简历微调' },
  { id: 'pack', label: '填写材料' },
  { id: 'exports', label: '导出记录' },
];
export function JobWorkspace({ data, initialTab, initialNotice }: { data: Data; initialTab?: string; initialNotice?: string }) {
  const router=useRouter(); const job=data.job; const versions=data.versions as any[]; const base=versions.filter(v=>!v.jobId); const branches=versions.filter(v=>v.jobId===job.id); const safeInitialTab=workspaceTabs.some(item=>item.id===initialTab)?initialTab as WorkspaceTab:'job'; const noticeText=initialNotice==='ready'?'已自动匹配基础简历并生成修改建议，请逐条确认。':initialNotice==='no_resume'?'岗位已保存，但还没有可匹配的基础简历。导入简历后即可开始微调。':initialNotice==='ai_unavailable'?'岗位和简历匹配已完成，但 AI 尚未连接。请到“AI 设置”查看连接状态。':initialNotice==='tune_failed'?'岗位分析已完成，但修改建议生成失败。可以在下方重新生成。':''; const [tab,setTab]=useState<WorkspaceTab>(safeInitialTab); const [selected,setSelected]=useState(data.run?.resumeVersionId||base[0]?.id||''); const [busy,setBusy]=useState(''); const [message,setMessage]=useState(noticeText); const [error,setError]=useState(''); const [suggestions,setSuggestions]=useState<any[]>(data.suggestions||[]); const analysis:JobAnalysis|null=useMemo(()=>{try{return job.analysisJson?JSON.parse(job.analysisJson):null}catch{return null}},[job.analysisJson]); const pack:ApplicationPackContent|null=useMemo(()=>{try{return data.pack?.contentJson?JSON.parse(data.pack.contentJson):null}catch{return null}},[data.pack]);
  useEffect(()=>setSuggestions(data.suggestions||[]),[data.suggestions]);
  async function call(path:string,body?:unknown){setBusy(path);setError('');setMessage('');const response=await fetch(path,{method:'POST',headers:body?{'content-type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});const result=await response.json() as any;setBusy('');if(!response.ok){setError(result.error||'操作失败');return false;}setMessage('已完成，内容已更新。');router.refresh();return true;}
  async function status(value:string){const response=await fetch(`/api/jobs/${job.id}/status`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({status:value})});if(response.ok)router.refresh();}
  return <div className="space-y-5 pb-24"><div className="flex flex-col gap-4 rounded-2xl border bg-white p-5 md:flex-row md:items-center md:justify-between"><div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground"><span>{job.company||'公司未识别'}</span><span>{job.role||'岗位未识别'}</span><span>{job.location||'地点未填写'}</span><span>{job.deadline?`截止 ${job.deadline}`:'截止时间未填写'}</span>{job.sourceUrl?<a className="text-primary" href={job.sourceUrl} target="_blank">打开官网 ↗</a>:null}</div><label className="flex items-center gap-2 text-sm">状态<select value={job.status} onChange={(e)=>status(e.target.value)} className="h-9 rounded-lg border bg-white px-3">{jobStatuses.map(s=><option key={s} value={s}>{jobStatusLabels[s]}</option>)}</select></label></div>
    {error?<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>:null}{message?<p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>:null}
    <div>
      <div role="tablist" aria-label="岗位工作区" className="flex w-full gap-1 overflow-x-auto rounded-xl border bg-white p-1.5">
        {workspaceTabs.map((item)=><button key={item.id} type="button" role="tab" aria-selected={tab===item.id} onClick={()=>setTab(item.id)} className={cn('shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition',tab===item.id?'bg-primary text-primary-foreground':'text-muted-foreground hover:bg-slate-100 hover:text-foreground')}>{item.label}</button>)}
      </div>
      {tab==='job'?<Panel title="岗位描述" action={null}><pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-slate-700">{job.jd}</pre></Panel>:null}
      {tab==='analysis'?<Panel title="岗位匹配分析" action={<ActionSetup base={base} selected={selected} setSelected={setSelected} label={analysis?'重新分析':'开始分析'} busy={busy.includes('analyze')} disabled={!selected} onClick={()=>call(`/api/jobs/${job.id}/analyze`,{resumeVersionId:selected})} />}>{analysis?<Analysis analysis={analysis}/>:<Empty text={base.length?'选择基础简历后，AI 会提取岗位要求、关键词、优势与缺口。':'请先到“简历版本”导入一份基础简历。'} />}</Panel>:null}
      {tab==='tune'?<div className="space-y-4"><Panel title="定向微调" action={<ActionSetup base={base} selected={selected} setSelected={setSelected} label="生成建议" busy={busy.includes('/tune')} disabled={!selected} onClick={()=>call(`/api/jobs/${job.id}/tune`,{resumeVersionId:selected})} />}>{suggestions.length?<div className="space-y-3">{suggestions.map((s:any)=><Suggestion key={s.id} suggestion={s} onChange={(updates)=>setSuggestions(current=>current.map(item=>item.id===s.id?{...item,...updates}:item))} />)}</div>:<Empty text="AI 建议会逐条展示原文、改写、理由和对应 JD。你可以接受、拒绝或编辑。" />}</Panel>{suggestions.length?<div className="flex justify-end"><Button onClick={()=>call(`/api/jobs/${job.id}/resume-versions`)} disabled={busy.includes('resume-versions')||suggestions.some((s:any)=>s.state==='pending')}>{suggestions.some((s:any)=>s.state==='pending')?'请先处理全部建议':'固化为不可变岗位版本'}</Button></div>:null}</div>:null}
      {tab==='pack'?<div className="space-y-4"><Panel title="官网填写材料包" action={<Button onClick={()=>call(`/api/jobs/${job.id}/application-pack`)} disabled={busy.includes('application-pack')}>{pack?'重新生成':'生成材料包'}</Button>}>{pack?<PackView pack={pack}/>:<Empty text="按个人信息、教育、经历、项目、技能证书和求职偏好分组，缺失值会明确标记。" />}</Panel>{pack?<CustomAnswer jobId={job.id} answers={data.answers||[]} onDone={()=>router.refresh()} />:null}</div>:null}
      {tab==='exports'?<Panel title="岗位简历版本" action={null}>{branches.length?<div className="space-y-3">{branches.map(v=><div key={v.id} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{v.resumeName} · v{v.versionNumber}</p><p className="mt-1 text-xs text-muted-foreground">生成于 {new Date(v.createdAt).toLocaleString('zh-CN')} · 内容快照不可变</p></div><div className="flex gap-2"><a className={buttonVariants({variant:'outline',size:'sm'})} href={`/api/resume-versions/${v.id}/export?format=docx`}><FileDown /> DOCX</a><a className={buttonVariants({variant:'outline',size:'sm'})} target="_blank" rel="noreferrer" href={`/api/resume-versions/${v.id}/export?format=pdf`}><FileDown /> PDF</a></div></div>)}</div>:<Empty text="确认全部微调建议并固化后，这里会出现可重复导出的版本。" />}</Panel>:null}
    </div></div>;
}
function Panel({title,action,children}:{title:string;action:React.ReactNode;children:React.ReactNode}){return <section className="mt-3 rounded-2xl border bg-white p-5 sm:p-6"><div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="font-semibold">{title}</h2>{action}</div>{children}</section>}
function ActionSetup({base,selected,setSelected,label,busy,disabled,onClick}:{base:any[];selected:string;setSelected:(v:string)=>void;label:string;busy:boolean;disabled:boolean;onClick:()=>void}){return <div className="flex flex-col gap-2 sm:flex-row"><select value={selected} onChange={e=>setSelected(e.target.value)} className="h-9 min-w-48 rounded-lg border bg-white px-3 text-sm"><option value="">选择基础简历</option>{base.map(v=><option key={v.id} value={v.id}>{v.resumeName} v{v.versionNumber}</option>)}</select><Button onClick={onClick} disabled={disabled||busy}><Sparkles />{busy?'处理中…':label}</Button></div>}
function Analysis({analysis}:{analysis:JobAnalysis}){return <div className="grid gap-5 lg:grid-cols-[180px_1fr]"><div className="rounded-2xl bg-[#eaf8f4] p-5 text-center"><p className="text-sm text-[#397264]">当前匹配度</p><p className="mt-2 text-5xl font-semibold text-[#0b7f64]">{analysis.score}</p><p className="mt-1 text-xs text-[#397264]">/ 100</p></div><div><p className="leading-7 text-slate-700">{analysis.summary}</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><List title="已有优势" items={analysis.strengths}/><List title="待补缺口" items={analysis.gaps}/><List title="硬性要求" items={analysis.mustHave}/><List title="关键词" items={analysis.keywords}/></div></div></div>}
function List({title,items}:{title:string;items:string[]}){return <div className="rounded-xl border p-4"><p className="font-medium">{title}</p><ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">{items.map((x,i)=><li key={i}>• {x}</li>)}</ul></div>}
function Suggestion({suggestion:s,onChange}:{suggestion:any;onChange:(updates:Record<string,unknown>)=>void}){
  const savedText=s.editedText||s.proposedText;
  const [edit,setEdit]=useState(savedText);
  const [busy,setBusy]=useState<''|'accepted'|'rejected'>('');
  const [actionError,setActionError]=useState('');
  const needsFact=Boolean(s.needsUserInput)&&edit.trim()===String(s.proposedText||'').trim();
  async function update(state:'accepted'|'rejected'){
    if(state==='accepted'&&needsFact){setActionError('这条建议缺少事实依据，请先在编辑框补充真实内容，再点击接受。');return;}
    setBusy(state);setActionError('');
    try{
      const response=await fetch(`/api/suggestions/${s.id}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({state,editedText:edit})});
      const result=await response.json().catch(()=>({})) as {error?:string};
      if(!response.ok){setActionError(result.error||'保存失败，请重试。');return;}
      onChange({state,editedText:edit});
    }catch{setActionError('网络连接失败，请重试。');}
    finally{setBusy('');}
  }
  function editText(value:string){setEdit(value);setActionError('');if(s.state==='accepted')onChange({state:'pending'});}
  return <article className={cn('rounded-2xl border p-4 transition sm:p-5',s.state==='accepted'&&'border-emerald-200 bg-emerald-50/20',s.state==='rejected'&&'bg-slate-50/60 opacity-80')}>
    <div className="flex flex-wrap items-center justify-between gap-2"><Badge variant={s.needsUserInput?'destructive':'outline'}>{s.needsUserInput?'待补充事实':s.sectionKey}</Badge><span aria-live="polite" className={cn('rounded-full px-2.5 py-1 text-xs font-medium',s.state==='accepted'?'bg-emerald-100 text-emerald-700':s.state==='rejected'?'bg-slate-200 text-slate-600':'bg-amber-50 text-amber-700')}>{s.state==='pending'?'待处理':s.state==='accepted'?'✓ 已接受':'已拒绝'}</span></div>
    <div className="mt-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-medium text-muted-foreground">修改对比</p><div className="flex gap-3 text-[11px] text-muted-foreground"><span><i className="mr-1 inline-block size-2 rounded-sm bg-red-100"/>删除</span><span><i className="mr-1 inline-block size-2 rounded-sm bg-emerald-200"/>新增</span></div></div><DiffHighlight before={s.originalText} after={edit}/></div>
    <div className="mt-4"><p className="text-xs font-medium text-muted-foreground">建议文本（可以继续编辑）</p><Textarea className="mt-2 min-h-28" value={edit} onChange={e=>editText(e.target.value)} /></div>
    {s.needsUserInput?<p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">这条内容需要你补充真实信息；修改编辑框后即可接受。</p>:null}
    <div className="mt-3 grid gap-2 text-sm leading-6 text-muted-foreground"><p><span className="font-medium text-foreground">理由：</span>{s.rationale}</p><p><span className="font-medium text-foreground">对应 JD：</span>{s.matchedRequirement}</p></div>
    {actionError?<p role="alert" className="mt-3 text-sm text-red-600">{actionError}</p>:null}
    <div className="mt-4 flex justify-end gap-2"><Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={()=>update('rejected')}><X />{busy==='rejected'?'保存中…':'拒绝'}</Button><Button size="sm" disabled={Boolean(busy)} onClick={()=>update('accepted')}><Check />{busy==='accepted'?'保存中…':s.state==='accepted'?'已接受':'接受'}{edit!==s.proposedText?'编辑稿':''}</Button></div>
  </article>
}

type DiffPart={type:'same'|'add'|'remove';text:string};
function DiffHighlight({before,after}:{before:string;after:string}){const parts=useMemo(()=>diffText(before,after),[before,after]);return <p className="mt-2 whitespace-pre-wrap rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 text-sm leading-7 text-slate-700">{parts.map((part,index)=>part.type==='add'?<mark key={index} className="rounded bg-emerald-200/80 px-0.5 text-emerald-950">{part.text}</mark>:part.type==='remove'?<del key={index} className="rounded bg-red-100 px-0.5 text-red-700 decoration-red-400">{part.text}</del>:<span key={index}>{part.text}</span>)}</p>}
function diffText(before:string,after:string):DiffPart[]{
  if(before===after)return[{type:'same',text:before}];
  const a=tokenize(before),b=tokenize(after);
  if(a.length>320||b.length>320)return simpleDiff(before,after);
  const rows=a.length+1,cols=b.length+1,table=Array.from({length:rows},()=>new Uint16Array(cols));
  for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)table[i][j]=a[i]===b[j]?table[i+1][j+1]+1:Math.max(table[i+1][j],table[i][j+1]);
  const parts:DiffPart[]=[];let i=0,j=0;
  const push=(type:DiffPart['type'],text:string)=>{const last=parts.at(-1);if(last?.type===type)last.text+=text;else parts.push({type,text});};
  while(i<a.length&&j<b.length){if(a[i]===b[j]){push('same',a[i++]);j++;}else if(table[i+1][j]>=table[i][j+1])push('remove',a[i++]);else push('add',b[j++]);}
  while(i<a.length)push('remove',a[i++]);while(j<b.length)push('add',b[j++]);return parts;
}
function tokenize(value:string){return value.match(/[\u3400-\u9fff]|[a-zA-Z0-9]+|\s+|[^\s\u3400-\u9fffa-zA-Z0-9]/g)||[];}
function simpleDiff(before:string,after:string):DiffPart[]{let start=0;while(start<before.length&&start<after.length&&before[start]===after[start])start++;let aEnd=before.length,bEnd=after.length;while(aEnd>start&&bEnd>start&&before[aEnd-1]===after[bEnd-1]){aEnd--;bEnd--;}const parts:DiffPart[]=[{type:'same',text:before.slice(0,start)},{type:'remove',text:before.slice(start,aEnd)},{type:'add',text:after.slice(start,bEnd)},{type:'same',text:before.slice(aEnd)}];return parts.filter(part=>part.text);}
function PackView({pack}:{pack:ApplicationPackContent}){const [copied,setCopied]=useState('');async function copy(id:string,value:string){await navigator.clipboard.writeText(value);setCopied(id);setTimeout(()=>setCopied(''),1200)}return <div className="space-y-5">{pack.missingFields.length?<div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900"><p className="font-medium">缺失 {pack.missingFields.length} 项</p><p className="mt-1 leading-6">{pack.missingFields.join('、')}</p></div>:null}{pack.groups.map(g=><section key={g.id}><div className="mb-2 flex items-center justify-between"><h3 className="font-medium">{g.title}</h3><button onClick={()=>copy(g.id,g.fields.map(f=>`${f.label}：${f.value}`).join('\n'))} className="text-xs text-primary">整组复制</button></div><div className="divide-y rounded-xl border">{g.fields.map(f=><div key={f.id} className="grid gap-2 p-4 sm:grid-cols-[150px_1fr_auto]"><div><p className="text-sm font-medium">{f.label}</p><p className="mt-1 text-xs text-muted-foreground">{f.source}</p></div><p className={f.missing?'text-amber-700':'whitespace-pre-wrap text-sm leading-6'}>{f.missing?'待补充':f.value}<span className="ml-2 text-xs text-muted-foreground">{f.value.length} 字</span></p><button disabled={f.missing} onClick={()=>copy(f.id,f.value)} className="h-fit text-xs text-primary disabled:text-slate-300"><Clipboard className="mr-1 inline size-3.5"/>{copied===f.id?'已复制':'复制'}</button></div>)}</div></section>)}</div>}
function CustomAnswer({jobId,answers,onDone}:{jobId:string;answers:any[];onDone:()=>void}){const [question,setQuestion]=useState('');const [limit,setLimit]=useState('300');const [busy,setBusy]=useState(false);const [error,setError]=useState('');async function submit(){setBusy(true);setError('');const response=await fetch(`/api/jobs/${jobId}/custom-answers`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question,charLimit:limit?Number(limit):undefined})});const data=await response.json() as any;setBusy(false);if(!response.ok)return setError(data.error||'生成失败');setQuestion('');onDone();}return <Panel title="临时开放题" action={null}><div className="grid gap-3 sm:grid-cols-[1fr_130px_auto]"><Input value={question} onChange={e=>setQuestion(e.target.value)} placeholder="粘贴官网问题"/><Input value={limit} onChange={e=>setLimit(e.target.value)} type="number" min="20" max="5000" aria-label="字数限制"/><Button onClick={submit} disabled={busy||question.trim().length<3}>{busy?'生成中…':'生成答案'}</Button></div>{error?<p className="mt-3 text-sm text-destructive">{error}</p>:null}{answers.length?<div className="mt-5 space-y-3">{answers.map(a=><div key={a.id} className="rounded-xl border p-4"><p className="font-medium">{a.question}</p><p className="mt-2 whitespace-pre-wrap leading-6 text-slate-700">{a.answer}</p><button className="mt-3 text-xs text-primary" onClick={()=>navigator.clipboard.writeText(a.answer)}>复制答案 · {a.answer.length} 字{a.charLimit?` / ${a.charLimit}`:''}</button></div>)}</div>:null}</Panel>}
function Empty({text}:{text:string}){return <div className="rounded-xl border border-dashed p-10 text-center text-sm leading-6 text-muted-foreground">{text}</div>}
