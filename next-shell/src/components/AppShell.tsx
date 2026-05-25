'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Boxes, Search } from 'lucide-react';
import type { AuthContext } from '@/features/auth/auth-model';

// ── Top-level tabs (main modes) ─────────────────────────────────────────────
const mainTabs = [
  { href: '/partcatalog', label: 'Part Catalog', icon: Search },
  { href: '/bulk-cost', label: 'Bulk Cost', icon: Boxes },
] as const;

// ── Utility nav (secondary) ─────────────────────────────────────────────────
export function AppShell({
  context,
  children,
}: {
  context: AuthContext;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isBulkCostPath = pathname.startsWith('/bulk-cost');

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };
  const lockWorkspace = pathname === '/partcatalog' || pathname.startsWith('/bulk-cost');
  const productTitle = isBulkCostPath ? 'QTEC PartCatalog' : 'QTEC AXON SYSTEM';
  const productSubtitle = isBulkCostPath ? 'Manual Bulk Cost Workspace' : 'Part Catalog & Cost Intelligence';

  useEffect(() => {
    if (!isBulkCostPath) return;
    document.title = 'QTEC Bulk Cost';
  }, [isBulkCostPath]);

  const topbar = (
    <header className="topbar">
      <div className="brand-mark" aria-label="QTEC">
        <img src="/items/logo_qtec.webp" alt="QTEC" className="brand-logo" />
      </div>
      <div>
        <div className="product-title">{productTitle}</div>
        <div className="product-subtitle">{productSubtitle}</div>
      </div>

      {/* ─── Main Tabs ───────────────────────────────────────────────────── */}
      <nav className="main-tabs" aria-label="Main navigation">
        {mainTabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.href);
          return (
            <Link
              className={`main-tab ${active ? 'main-tab-active' : ''}`}
              href={tab.href}
              key={tab.href}
            >
              <Icon size={16} aria-hidden="true" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="topbar-spacer" />

      <div className="user-summary" title={context.actor.displayName}>
        <span className="user-avatar">
          {context.actor.displayName.slice(0, 1).toUpperCase()}
        </span>
        <span className="user-name">{context.actor.displayName}</span>
      </div>
    </header>
  );

  return (
    <div className={`app-shell ${lockWorkspace ? 'app-shell-locked' : ''}`}>
      {/* ─── Locked pages: topbar outside shell-body → always visible ───── */}
      {lockWorkspace && topbar}

      {/* ─── Body ──────────────────────────────────────────────────────────── */}
      <div className="shell-body">
        {/* Non-locked pages: topbar inside shell-body → scrolls with content */}
        {!lockWorkspace && topbar}
        <main className={`content-area ${lockWorkspace ? 'content-area-locked' : ''}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
