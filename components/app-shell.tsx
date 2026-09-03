import Link from 'next/link';
import {
  BriefcaseBusiness,
  FileText,
  LayoutDashboard,
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
      <div className="mx-auto flex min-h-screen max-w-[1500px]">
        <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar px-4 py-5 lg:flex lg:flex-col">
          <Link href="/" className="flex items-center gap-3 px-2">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm"><Sparkles className="size-[18px]" /></span>
            <span><span className="block text-[15px] font-semibold">秋招速投</span><span className="block text-[11px] text-muted-foreground">个人投递工作台</span></span>
          </Link>
          <nav className="mt-8 space-y-1" aria-label="主要导航">
            {nav.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground">
                <Icon className="size-[17px]" />{label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto rounded-xl border bg-white/70 p-3 text-xs leading-5 text-muted-foreground">
            <p className="font-medium text-foreground">隐私说明</p>
            <p className="mt-1">站点仅登录可访问。身份证号等敏感字段按你的选择以普通数据库字段保存，未增加应用层加密。</p>
          </div>
        </aside>
        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex min-h-[72px] items-center justify-between border-b bg-white/90 px-5 backdrop-blur sm:px-8">
            <div>
              {eyebrow ? <p className="text-xs font-medium text-primary">{eyebrow}</p> : null}
              <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
            </div>
            <Link href="/jobs/new" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90">+ 新建岗位</Link>
          </header>
          <div className="p-5 sm:p-8">{children}</div>
        </section>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-white/95 p-1 backdrop-blur lg:hidden" aria-label="移动端导航">
        {nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="flex flex-col items-center gap-1 rounded-lg py-2 text-[11px] text-muted-foreground"><Icon className="size-4" />{label}</Link>)}
      </nav>
    </main>
  );
}
