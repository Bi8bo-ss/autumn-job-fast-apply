import {
  BriefcaseBusiness,
  FileText,
  LayoutDashboard,
  Settings,
  Sparkles,
  UserRound,
  Workflow,
} from 'lucide-react';

const nav = [
  { href: '/', label: '工作台', icon: LayoutDashboard },
  { href: '/jobs', label: '岗位', icon: BriefcaseBusiness },
  { href: '/resumes', label: '简历版本', icon: FileText },
  { href: '/profile', label: '个人档案', icon: UserRound },
  { href: '/pipeline', label: '投递看板', icon: Workflow },
  { href: '/settings', label: 'AI 设置', icon: Settings },
];

export function AppShell({
  children,
  title,
  eyebrow,
}: {
  children: React.ReactNode;
  title: string;
  eyebrow?: string;
}) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="relative hidden w-[270px] shrink-0 overflow-hidden border-r border-white/[.07] bg-[#071827] px-5 py-6 text-white lg:flex lg:flex-col">
          <div className="pointer-events-none absolute -left-28 top-28 size-72 rounded-full bg-cyan-400/[.06] blur-3xl" />
          <div className="pointer-events-none absolute -right-32 bottom-10 size-72 rounded-full bg-emerald-400/[.05] blur-3xl" />
          <a href="/" data-interactive="true" className="relative flex items-center gap-3 rounded-2xl px-2 py-1">
            <span className="grid size-10 place-items-center rounded-[14px] bg-gradient-to-br from-cyan-300 to-emerald-400 text-[#06212c] shadow-[0_10px_30px_-10px_rgba(34,211,238,.8)]"><Sparkles className="size-[18px]" /></span>
            <span><span className="block text-[15px] font-semibold tracking-wide">秋招速投</span><span className="mt-0.5 block text-[11px] text-slate-400">PERSONAL WORKSPACE</span></span>
          </a>
          <nav className="relative mt-10 space-y-1.5" aria-label="主要导航">
            {nav.map(({ href, label, icon: Icon }) => (
              <a key={href} href={href} data-interactive="true" className="group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-400 transition hover:bg-white/[.07] hover:text-white">
                <Icon className="size-[17px]" />{label}
              </a>
            ))}
          </nav>
          <div className="relative mt-auto rounded-2xl border border-white/[.08] bg-white/[.045] p-4 text-xs leading-5 text-slate-400 backdrop-blur">
            <div className="mb-2 flex items-center gap-2 text-slate-200"><span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.8)]" /><p className="font-medium">私密工作区</p></div>
            <p>仅登录可访问。AI 请求会隐藏联系方式与证件信息。</p>
          </div>
        </aside>
        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex min-h-[76px] items-center justify-between border-b border-slate-200/70 bg-white/75 px-5 backdrop-blur-xl sm:px-8">
            <div>
              {eyebrow ? <p className="text-[10px] font-semibold tracking-[.16em] text-primary">{eyebrow}</p> : null}
              <h1 className="mt-0.5 text-lg font-semibold tracking-[-0.02em]">{title}</h1>
            </div>
            <div className="flex items-center gap-2">
              <a href="/settings" data-interactive="true" aria-label="打开 AI 设置" title="AI 设置" className="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:text-primary hover:shadow-md"><Settings className="size-[17px]" /></a>
              <a href="/jobs/new" data-interactive="true" className="rounded-xl bg-[#087e72] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_28px_-12px_rgba(8,126,114,.75)] transition hover:-translate-y-0.5 hover:bg-[#076f66] hover:shadow-lg">+ 新建岗位</a>
            </div>
          </header>
          <div className="page-enter p-5 sm:p-8">{children}</div>
        </section>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-slate-200/80 bg-white/90 p-1 backdrop-blur-xl lg:hidden" aria-label="移动端导航">
        {nav.map(({ href, label, icon: Icon }) => <a key={href} href={href} data-interactive="true" className="flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-medium text-muted-foreground transition hover:bg-accent hover:text-primary"><Icon className="size-4" />{label}</a>)}
      </nav>
    </main>
  );
}
