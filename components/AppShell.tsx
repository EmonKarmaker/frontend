"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
}

/* ── Inline SVG icons — no external library ──────────────────────── */

const DashboardIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

const BillsIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="16" y2="17" />
  </svg>
);

const ShoppingIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <path d="M16 10a4 4 0 0 1-8 0" />
  </svg>
);

const MealsIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
    <path d="M7 2v20" />
    <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
  </svg>
);

const MonthsIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const SettlementsIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="m17 1 4 4-4 4" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <path d="m7 23-4-4 4-4" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
);

const AssetsIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const MembersIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const RoomsIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const HamburgerIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const LogoutIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

/* ── Nav items ───────────────────────────────────────────────────── */

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",   href: "/dashboard",   icon: <DashboardIcon /> },
  { label: "Bills",       href: "/bills",       icon: <BillsIcon /> },
  { label: "Shopping",    href: "/shopping",    icon: <ShoppingIcon /> },
  { label: "Meals",       href: "/meals",       icon: <MealsIcon /> },
  { label: "Months",      href: "/months",      icon: <MonthsIcon /> },
  { label: "Settlements", href: "/settlements", icon: <SettlementsIcon /> },
  { label: "Assets",      href: "/assets",      icon: <AssetsIcon /> },
  { label: "Members",     href: "/members",     icon: <MembersIcon /> },
  { label: "Rooms",       href: "/rooms",       icon: <RoomsIcon /> },
];

/* ── AppShell ────────────────────────────────────────────────────── */

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const householdName = user?.household_name ?? "Household";
  const roleLabel = user?.is_admin ? "Admin" : "Member";

  return (
    <div className="flex h-screen bg-bg overflow-hidden">

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 bg-surface-1 border-r border-border">
        <SidebarContent
          pathname={pathname}
          householdName={householdName}
          roleLabel={roleLabel}
          onClose={() => {}}
          onLogout={logout}
        />
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/60 z-40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="md:hidden fixed inset-y-0 left-0 w-64 z-50 flex flex-col bg-surface-1 border-r border-border animate-slide-in-left">
            <SidebarContent
              pathname={pathname}
              householdName={householdName}
              roleLabel={roleLabel}
              onClose={() => setMobileOpen(false)}
              onLogout={logout}
              showClose
            />
          </aside>
        </>
      )}

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-4 h-14 bg-surface-1 border-b border-border shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 -ml-2 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors"
            aria-label="Open navigation"
          >
            <HamburgerIcon />
          </button>
          <span className="font-display text-sm font-semibold text-fg tracking-wide">
            {householdName}
          </span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

      </div>
    </div>
  );
}

/* ── Sidebar contents (shared by desktop + mobile drawer) ───────── */

interface SidebarContentProps {
  pathname: string;
  householdName: string;
  roleLabel: string;
  onClose: () => void;
  onLogout: () => void;
  showClose?: boolean;
}

function SidebarContent({ pathname, householdName, roleLabel, onClose, onLogout, showClose }: SidebarContentProps) {
  return (
    <>
      {/* Brand */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
        <span className="font-display text-sm font-semibold text-fg tracking-wide">
          {householdName}
        </span>
        {showClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors"
            aria-label="Close navigation"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV_ITEMS.map((item, i) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={[
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm",
                "transition-all duration-150 animate-fade-up",
                i === 0 ? "delay-75" : i === 1 ? "delay-150" : i === 2 ? "delay-225" : i === 3 ? "delay-300" : "delay-375",
                active
                  ? "bg-accent/10 text-accent border border-accent/20 glow-sm font-medium"
                  : "text-fg-muted border border-transparent hover:text-fg hover:bg-surface-2",
              ].join(" ")}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-border p-3 space-y-1">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-2">
          <div className="size-7 rounded-full bg-accent/15 border border-accent/20 flex items-center justify-center shrink-0">
            <span className="font-display text-xs font-bold text-accent">
              {householdName.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-fg truncate">{householdName}</p>
            <p className="text-xs text-fg-muted">{roleLabel}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-fg-muted hover:text-danger hover:bg-danger/8 transition-all duration-150"
        >
          <LogoutIcon />
          Log out
        </button>
      </div>
    </>
  );
}
