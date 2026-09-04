import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { JobWorkspace } from '@/components/job-workspace';
import { requirePageUser } from '@/lib/server/auth';
import { getJobWorkspace } from '@/lib/server/data';
export const dynamic = 'force-dynamic';
export default async function JobPage({ params, searchParams }: { params: Promise<{ id:string }>; searchParams: Promise<{ tab?:string; notice?:string }> }) { const {id}=await params; const query=await searchParams; const user=await requirePageUser(`/jobs/${id}`); const data=await getJobWorkspace(user.userId,id); if(!data.job) notFound(); const title=[data.job.company,data.job.role].filter(Boolean).join(' · ')||'待补充岗位信息'; return <AppShell title={title} eyebrow="JOB WORKSPACE"><JobWorkspace data={JSON.parse(JSON.stringify(data))} initialTab={query.tab} initialNotice={query.notice} /></AppShell>; }
