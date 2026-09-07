'use client';

import { usePathname } from 'next/navigation';
import {
  BriefcaseBusiness,
  ChevronRight,
  FileText,
  LayoutDashboard,
  Menu,
  Plus,
  Settings,
  Target,
  UserRound,
  Workflow,
} from 'lucide-react';
import { AppLink } from '@/components/app-link';
import { cn } from '@/lib/utils';

const primaryNav = [
  { href: '/', label: '工作台', icon: LayoutDashboard },
  { href: '/jobs', label: '岗位', icon: BriefcaseBusiness },
  { href: '/resumes', label: '简历', icon: FileText },
  { href: '/pipeline', label: '投递', icon: Workflow },
];

const secondaryNav = [
  { href: '/profile', label: '个人档案', icon: UserRound },
  { href: '/settings', label: 'AI 设置', icon: Settings },
];

const desktopNav = [
  primaryNav[0],
  primaryNav[1],
  primaryNav[2],
  secondaryNav[0],
  primaryNav[3],
  secondaryNav[1],
];

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  children,
  title,
  description,
  showNewJob = false,
}: {
  children: React.ReactNode;
  title: string;
  description?: string;
  showNewJob?: boolean;
}) {
  const pathname = usePathname();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-[1680px]">
        <aside className="hidden w-[216px] shrink-0 border-r bg-white lg:flex lg:flex-col">
          <AppLink href="/" className="flex h-[72px] items-center gap-3 border-b px-5" data-interactive="true">
            <span className="grid size-9 place-items-center rounded-lg bg-primary text-white">
              <Target className="size-5" strokeWidth={2.3} />
            </span>
            <span>
              <strong className="block text-[15px] font-semibold">秋招速投</strong>
              <span className="mt-0.5 block text-xs text-muted-foreground">个人投递工作台</span>
            </span>
          </AppLink>

          <nav className="space-y-1 px-3 py-5" aria-label="主要导航">
            {desktopNav.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <AppLink
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  data-interactive="true"
                  className={cn(
                    'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
                    active
                      ? 'bg-[#edf3ff] text-primary'
                      : 'text-[#58657a] hover:bg-slate-50 hover:text-foreground',
                  )}
                >
                  <Icon className="size-[18px]" strokeWidth={active ? 2.2 : 1.8} />
                  {label}
                </AppLink>
              );
            })}
          </nav>

          <div className="mt-auto border-t px-5 py-5">
            <div className="flex items-center gap-2 text-sm font-medium text-[#344054]">
              <span className="status-dot bg-emerald-500" />
              私密工作区
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">联系方式和证件信息不会发送给 AI。</p>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex min-h-[72px] items-center justify-between gap-4 border-b bg-white/95 px-4 backdrop-blur sm:px-6 xl:px-8">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-[-0.02em] sm:text-xl">{title}</h1>
              {description ? <p className="mt-1 hidden truncate text-sm text-muted-foreground sm:block">{description}</p> : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {showNewJob && pathname !== '/jobs/new' ? (
                <AppLink
                  href="/jobs/new"
                  data-interactive="true"
                  className="pressable inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-semibold text-white shadow-[0_5px_14px_-7px_rgb(21_94_239_/_75%)] hover:bg-[#0f52d5]"
                >
                  <Plus className="size-4" />
                  <span className="hidden sm:inline">新建岗位</span>
                  <span className="sm:hidden">新建</span>
                </AppLink>
              ) : null}
            </div>
          </header>

          <div className="page-enter px-4 py-5 pb-24 sm:px-6 sm:py-7 xl:px-8 lg:pb-8">{children}</div>
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-white/96 px-1 pb-[max(.25rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur lg:hidden" aria-label="移动端导航">
        {primaryNav.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <AppLink
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              data-interactive="true"
              className={cn(
                'flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <Icon className="size-[18px]" strokeWidth={active ? 2.25 : 1.8} />
              {label}
            </AppLink>
          );
        })}
        <details className="group relative">
          <summary className={cn(
            'flex min-h-[52px] list-none flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium [&::-webkit-details-marker]:hidden',
            secondaryNav.some((item) => isActive(pathname, item.href)) ? 'text-primary' : 'text-muted-foreground',
          )}>
            <Menu className="size-[18px]" />
            更多
          </summary>
          <div className="absolute bottom-[58px] right-1 w-48 overflow-hidden rounded-xl border bg-white p-1.5 shadow-[0_16px_36px_-16px_rgb(15_23_42_/_38%)]">
            {secondaryNav.map(({ href, label, icon: Icon }) => (
              <AppLink key={href} href={href} data-interactive="true" className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-[#354057] hover:bg-slate-50">
                <Icon className="size-[18px] text-muted-foreground" />
                <span className="flex-1">{label}</span>
                <ChevronRight className="size-4 text-slate-400" />
              </AppLink>
            ))}
          </div>
        </details>
      </nav>
    </main>
  );
}
