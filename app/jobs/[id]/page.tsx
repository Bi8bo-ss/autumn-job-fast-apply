import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { JobWorkspace } from '@/components/job-workspace';
import { requirePageUser } from '@/lib/server/auth';
import { getJobWorkspace } from '@/lib/server/data';
export const dynamic = 'force-dynamic';
export default async function JobPage({ params }: { params: Promise<{ id:string }> }) { const {id}=await params; const user=await requirePageUser(`/jobs/${id}`); const data=await getJobWorkspace(user.userId,id); if(!data.job) notFound(); return <AppShell title={`${data.job.company} · ${data.job.role}`} eyebrow="JOB WORKSPACE"><JobWorkspace data={JSON.parse(JSON.stringify(data))} /></AppShell>; }
