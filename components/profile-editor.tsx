'use client';

import { useId, useMemo, useState } from 'react';
import { Check, CircleAlert, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Profile } from '@/lib/product-types';

type Experience = Profile['experiences'][number];
type SaveResponse = { error?: string };

const sections = [
  ['identity', '基础信息'],
  ['education', '教育经历'],
  ['experience', '实习 / 工作'],
  ['projects', '项目经历'],
  ['skills', '能力与资质'],
  ['summary', '自我评价'],
  ['preferences', '求职偏好'],
] as const;

export function ProfileEditor({ initial }: { initial: Profile }) {
  const [profile, setProfile] = useState(initial);
  const [savedSnapshot, setSavedSnapshot] = useState(JSON.stringify(initial));
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState('');
  const dirty = JSON.stringify(profile) !== savedSnapshot;
  const identity = profile.identity;
  const completion = useMemo(() => {
    const checks = [
      identity.name, identity.email, identity.phone, identity.location,
      profile.education.length, profile.experiences.length || profile.projects.length,
      profile.skills.length, profile.preferences.desiredRoles.length,
    ];
    return Math.round(checks.filter(Boolean).length / checks.length * 100);
  }, [identity, profile]);

  const setIdentity = (key: keyof typeof identity, value: string) => {
    setProfile((current) => ({ ...current, identity: { ...current.identity, [key]: value } }));
  };
  const setList = (key: 'skills' | 'certificates' | 'awards' | 'languages', value: string) => {
    setProfile((current) => ({ ...current, [key]: value.split(/[，,\n]/).map((item) => item.trim()).filter(Boolean) }));
  };

  async function save() {
    setState('saving');
    setError('');
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(profile),
      });
      const data = await response.json() as SaveResponse;
      if (!response.ok) throw new Error(data.error || '保存失败，请重试。');
      setSavedSnapshot(JSON.stringify(profile));
      setState('saved');
      window.setTimeout(() => setState('idle'), 1800);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败，请重试。');
      setState('idle');
    }
  }

  function confirmDelete(label: string, remove: () => void) {
    if (window.confirm(`确定删除这条${label}吗？删除后仍需点击“保存档案”才会生效。`)) remove();
  }

  return (
    <div className="mx-auto grid max-w-[1280px] gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="h-fit lg:sticky lg:top-[96px]">
        <div className="workspace-panel overflow-hidden">
          <div className="border-b p-4">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-semibold">档案完成度</p>
              <span className="text-lg font-semibold tabular-nums text-primary">{completion}%</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${completion}%` }} />
            </div>
          </div>
          <nav className="hidden p-2 lg:block" aria-label="档案分区">
            {sections.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="block rounded-lg px-3 py-2.5 text-sm text-[#58657a] hover:bg-slate-50 hover:text-foreground">{label}</a>
            ))}
          </nav>
        </div>
        <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-4 text-xs leading-5 text-orange-900">
          <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4" />敏感信息提示</div>
          <p className="mt-2">证件号等信息不会发送给 AI，只填写投递确实需要的内容。</p>
        </div>
      </aside>

      <div className="min-w-0 space-y-5 pb-20">
        <Section id="identity" title="基础信息" description="联系方式会用于填写材料，但在 AI 处理前会被隐藏。">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Field label="姓名" value={identity.name} onChange={(value) => setIdentity('name', value)} />
            <Field label="邮箱" value={identity.email} onChange={(value) => setIdentity('email', value)} />
            <Field label="手机" value={identity.phone} onChange={(value) => setIdentity('phone', value)} />
            <Field label="所在地" value={identity.location} onChange={(value) => setIdentity('location', value)} />
            <Field label="出生日期" value={identity.birthDate} type="date" onChange={(value) => setIdentity('birthDate', value)} />
            <Field label="身份证号（可选）" value={identity.idNumber} onChange={(value) => setIdentity('idNumber', value)} />
          </div>
        </Section>

        <Section id="education" title="教育经历">
          <div className="divide-y rounded-lg border">
            {profile.education.map((entry, index) => (
              <div key={entry.id} className="p-4">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <Field label="学校" value={entry.school} onChange={(value) => setProfile((current) => ({ ...current, education: current.education.map((item, itemIndex) => itemIndex === index ? { ...item, school: value } : item) }))} />
                  <Field label="学位" value={entry.degree} onChange={(value) => setProfile((current) => ({ ...current, education: current.education.map((item, itemIndex) => itemIndex === index ? { ...item, degree: value } : item) }))} />
                  <Field label="专业" value={entry.major} onChange={(value) => setProfile((current) => ({ ...current, education: current.education.map((item, itemIndex) => itemIndex === index ? { ...item, major: value } : item) }))} />
                  <Field label="GPA / 排名" value={[entry.gpa, entry.rank].filter(Boolean).join(' / ')} onChange={(value) => setProfile((current) => ({ ...current, education: current.education.map((item, itemIndex) => itemIndex === index ? { ...item, gpa: value } : item) }))} />
                  <Field label="开始时间" type="month" value={entry.startDate} onChange={(value) => setProfile((current) => ({ ...current, education: current.education.map((item, itemIndex) => itemIndex === index ? { ...item, startDate: value } : item) }))} />
                  <Field label="结束时间" type="month" value={entry.endDate} onChange={(value) => setProfile((current) => ({ ...current, education: current.education.map((item, itemIndex) => itemIndex === index ? { ...item, endDate: value } : item) }))} />
                </div>
                <DeleteButton label="教育经历" onClick={() => confirmDelete('教育经历', () => setProfile((current) => ({ ...current, education: current.education.filter((_, itemIndex) => itemIndex !== index) })))} />
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" className="mt-4" onClick={() => setProfile((current) => ({ ...current, education: [...current.education, { id: crypto.randomUUID(), school: '', degree: '', major: '', startDate: '', endDate: '', gpa: '', rank: '', highlights: [] }] }))}>添加教育经历</Button>
        </Section>

        <div id="experience"><ExperienceSection title="实习 / 工作经历" entries={profile.experiences} onChange={(entries) => setProfile((current) => ({ ...current, experiences: entries }))} confirmDelete={confirmDelete} /></div>
        <div id="projects"><ExperienceSection title="项目经历" entries={profile.projects} onChange={(entries) => setProfile((current) => ({ ...current, projects: entries }))} confirmDelete={confirmDelete} /></div>

        <Section id="skills" title="能力与资质">
          <div className="grid gap-4 sm:grid-cols-2">
            <ListField label="技能" value={profile.skills.join('，')} onChange={(value) => setList('skills', value)} placeholder="SQL，Python，Figma" />
            <ListField label="语言" value={profile.languages.join('，')} onChange={(value) => setList('languages', value)} placeholder="英语 CET-6，普通话" />
            <ListField label="证书" value={profile.certificates.join('，')} onChange={(value) => setList('certificates', value)} />
            <ListField label="奖项" value={profile.awards.join('，')} onChange={(value) => setList('awards', value)} />
          </div>
        </Section>

        <Section id="summary" title="自我评价">
          <div className="grid gap-4 xl:grid-cols-2">
            <ListField label="中文版" rows={6} value={profile.summaries.zh} onChange={(value) => setProfile((current) => ({ ...current, summaries: { ...current.summaries, zh: value } }))} />
            <ListField label="English" rows={6} value={profile.summaries.en} onChange={(value) => setProfile((current) => ({ ...current, summaries: { ...current.summaries, en: value } }))} />
          </div>
        </Section>

        <Section id="preferences" title="求职偏好">
          <div className="grid gap-4 sm:grid-cols-2">
            <ListField label="目标岗位（逗号分隔）" value={profile.preferences.desiredRoles.join('，')} onChange={(value) => setProfile((current) => ({ ...current, preferences: { ...current.preferences, desiredRoles: value.split(/[，,]/).map((item) => item.trim()).filter(Boolean) } }))} />
            <ListField label="目标城市（逗号分隔）" value={profile.preferences.desiredLocations.join('，')} onChange={(value) => setProfile((current) => ({ ...current, preferences: { ...current.preferences, desiredLocations: value.split(/[，,]/).map((item) => item.trim()).filter(Boolean) } }))} />
            <Field label="到岗时间" value={profile.preferences.availability} onChange={(value) => setProfile((current) => ({ ...current, preferences: { ...current.preferences, availability: value } }))} />
            <Field label="期望薪资" value={profile.preferences.expectedSalary} onChange={(value) => setProfile((current) => ({ ...current, preferences: { ...current.preferences, expectedSalary: value } }))} />
          </div>
        </Section>

        {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><CircleAlert className="mr-2 inline size-4" />{error}</p> : null}
        <div className="sticky bottom-[65px] z-20 flex items-center justify-between gap-4 rounded-xl border bg-white/96 px-4 py-3 shadow-[0_10px_30px_-18px_rgb(15_23_42_/_38%)] backdrop-blur lg:bottom-4">
          <p className="text-sm text-muted-foreground">{state === 'saved' ? '更改已保存' : dirty ? '有未保存的更改' : '当前内容已保存'}</p>
          <Button onClick={save} disabled={state === 'saving' || !dirty}>
            {state === 'saving' ? <Save className="animate-pulse" /> : state === 'saved' ? <Check /> : <Save />}
            {state === 'saving' ? '保存中…' : '保存档案'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="workspace-panel scroll-mt-24 p-5 sm:p-6">
      <h2 className="text-base font-semibold">{title}</h2>
      {description ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  const id = useId();
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} /></div>;
}

function ListField({ label, value, onChange, placeholder, rows = 3 }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; rows?: number }) {
  const id = useId();
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Textarea id={id} rows={rows} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></div>;
}

function DeleteButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md px-2 text-sm font-medium text-destructive hover:bg-red-50" onClick={onClick}><Trash2 className="size-4" />删除此条{label}</button>;
}

function ExperienceSection({ title, entries, onChange, confirmDelete }: { title: string; entries: Experience[]; onChange: (entries: Experience[]) => void; confirmDelete: (label: string, remove: () => void) => void }) {
  return (
    <Section id="" title={title}>
      <div className="divide-y rounded-lg border">
        {entries.map((entry, index) => {
          const update = <K extends keyof Experience>(key: K, value: Experience[K]) => onChange(entries.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
          return (
            <div key={entry.id} className="p-4">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <Field label="名称 / 职位" value={entry.title} onChange={(value) => update('title', value)} />
                <Field label="组织 / 公司" value={entry.organization} onChange={(value) => update('organization', value)} />
                <Field label="地点" value={entry.location} onChange={(value) => update('location', value)} />
                <Field label="开始时间" type="month" value={entry.startDate} onChange={(value) => update('startDate', value)} />
                <Field label="结束时间" type="month" value={entry.endDate} onChange={(value) => update('endDate', value)} />
              </div>
              <div className="mt-4"><ListField label="事实亮点（每行一条）" rows={4} value={entry.highlights.join('\n')} onChange={(value) => update('highlights', value.split('\n').map((item) => item.trim()).filter(Boolean))} /></div>
              <DeleteButton label={title} onClick={() => confirmDelete(title, () => onChange(entries.filter((_, itemIndex) => itemIndex !== index)))} />
            </div>
          );
        })}
      </div>
      <Button type="button" variant="outline" className="mt-4" onClick={() => onChange([...entries, { id: crypto.randomUUID(), title: '', organization: '', startDate: '', endDate: '', location: '', highlights: [] }])}>添加{title}</Button>
    </Section>
  );
}
