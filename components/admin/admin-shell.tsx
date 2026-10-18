"use client";

import { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  BadgeDollarSign,
  Tags,
  ShieldCheck,
  ScrollText,
  Terminal,
  Wallet,
  LogOut,
  Lock,
  type LucideIcon,
} from "lucide-react";
import { ADMIN_ROUTES } from "@/lib/constants";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [guardianActive, setGuardianActive] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch("/api/admin/guardian/status")
      .then((res) => res.json())
      .then((data) => {
        if (mounted && typeof data.active === "boolean") {
          setGuardianActive(data.active);
        }
      })
      .catch(() => {
        if (mounted) setGuardianActive(false);
      });
    return () => {
      mounted = false;
    };
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
    } catch {
      // ignore error
    }
    // Never reveal the panel location after sign-out — go to the homepage.
    router.push("/");
    router.refresh();
  };

  const navItems: NavItem[] = [
    { label: "Overview", href: ADMIN_ROUTES.overview, icon: LayoutDashboard },
    { label: "Operator", href: ADMIN_ROUTES.operator, icon: Terminal },
    { label: "Users", href: ADMIN_ROUTES.users, icon: Users },
    { label: "Plans & pricing", href: ADMIN_ROUTES.plans, icon: BadgeDollarSign },
    { label: "Promo codes", href: ADMIN_ROUTES.promoCodes, icon: Tags },
    { label: "Security guardian", href: ADMIN_ROUTES.securityChat, icon: ShieldCheck },
    { label: "Audit logs", href: ADMIN_ROUTES.auditLogs, icon: ScrollText },
    { label: "Finance", href: ADMIN_ROUTES.finance, icon: Wallet },
  ];

  const guardianLabel =
    guardianActive === true
      ? "Security guardian active & monitoring"
      : guardianActive === false
        ? "Security guardian offline — waiting for AI key"
        : "Checking security guardian…";
  const guardianShort =
    guardianActive === true ? "Guardian on" : guardianActive === false ? "Guardian off" : "Checking…";

  return (
    <div
      dir="ltr"
      lang="en"
      translate="no"
      className="notranslate flex min-h-screen flex-col bg-paper font-sans text-ink"
    >
      {/* Top header — one compact row on every width */}
      <header className="sticky top-0 z-40 border-b border-line bg-paper-high/90 shadow-xs backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6">
          <Link href={ADMIN_ROUTES.overview} className="flex h-10 min-w-0 items-center gap-2.5">
            {/* Same OUM lockup as the rest of the site (mark + name) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/oum-logo.png"
              alt="OUM logo"
              width={694}
              height={575}
              className="h-8 w-8 shrink-0 object-contain"
            />
            <span className="truncate text-[15px] font-semibold tracking-tight text-ink">
              OUM HQ
            </span>
            <span
              className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full border border-red-200 bg-red-50 px-1.5 text-[11px] font-semibold text-red-700 sm:px-2"
              title="Restricted admin panel"
              aria-label="Restricted admin panel"
            >
              <Lock className="h-3 w-3" aria-hidden="true" />
              <span className="hidden sm:inline">Restricted admin panel</span>
            </span>
          </Link>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <div
              className={`flex h-9 items-center gap-2 rounded-full border px-2.5 text-xs transition-colors ${
                guardianActive === true
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : guardianActive === false
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-line bg-paper-low text-ink-mute"
              }`}
              title={guardianLabel}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  guardianActive === true
                    ? "animate-pulse bg-emerald-500"
                    : guardianActive === false
                      ? "bg-amber-500"
                      : "bg-ink-mute"
                }`}
                aria-hidden="true"
              />
              <span className="hidden font-medium md:inline">{guardianLabel}</span>
              <span className="font-medium md:hidden">{guardianShort}</span>
            </div>

            <button
              onClick={handleLogout}
              aria-label="Sign out"
              className="inline-flex h-10 w-10 items-center justify-center gap-2 rounded-md border border-line bg-paper-high px-0 text-xs font-medium text-ink-soft transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-paper sm:w-auto sm:justify-start sm:px-3"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>

        {/* Section tabs — horizontally scrollable on narrow screens, 44px targets */}
        <nav aria-label="Admin sections" className="border-t border-line/70">
          <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-500 ${
                    isActive
                      ? "border-ink text-ink"
                      : "border-transparent text-ink-mute hover:border-line-strong hover:text-ink"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 ${isActive ? "text-ink" : "text-ink-faint"}`}
                    aria-hidden="true"
                  />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      {/* Page Content */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>

      {/* Footer */}
      <footer className="border-t border-line bg-paper-high px-4 py-3 text-center text-xs text-ink-mute sm:px-6">
        The secure OUM HQ gateway — restricted to authorized administrators only. All actions are
        recorded in an immutable audit log.
      </footer>
    </div>
  );
}
