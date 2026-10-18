'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Tv,
  CreditCard,
  ShieldAlert,
  ShieldCheck,
  Inbox,
  ScrollText,
  Wallet,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/loading-skeleton';
import { ADMIN_ROUTES } from '@/lib/constants';

interface HealthItem {
  ok: boolean;
  label: string;
}

interface OverviewKPIs {
  totalUsers: number;
  activeChannels: number;
  totalContentItems: number;
  mrrFormatted: string;
  newUsersThisMonth: number;
  securityWarnings: number;
  queueBacklog: number;
  allSystemsOk: boolean;
  systemHealth: {
    database: HealthItem;
    aiEngine: HealthItem;
    guardian: HealthItem;
    redis: HealthItem;
  };
  activeSubscriptions: number;
}

const HEALTH_TITLES: Record<keyof OverviewKPIs['systemHealth'], string> = {
  database: 'Database (PostgreSQL)',
  aiEngine: 'AI engine',
  guardian: 'Security guardian',
  redis: 'Redis',
};

interface ContactInquiry {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  ipAddress?: string;
  createdAt: string;
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<{ kpis: OverviewKPIs; inquiries?: ContactInquiry[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/overview')
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch overview data:', err);
        setLoading(false);
      });
  }, []);

  const kpis = data?.kpis;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">Platform overview — HQ</h1>
          <p className="text-sm text-ink-mute">
            Real-time platform metrics, user statistics, security posture, and system health.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="default"
            className={`px-3 py-1 ${
              kpis
                ? kpis.allSystemsOk
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  : 'bg-amber-100 text-amber-800 border-amber-200'
                : 'bg-paper-low text-ink-mute border-line'
            }`}
          >
            {kpis
              ? kpis.allSystemsOk
                ? 'All systems operational'
                : 'Degraded — see health below'
              : 'Checking system...'}
          </Badge>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4">
        <Card className="bg-paper-high border-line hover:border-line-strong transition-all shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-ink-mute uppercase tracking-wider">
              <span>Total users</span>
              <Users className="h-4 w-4 text-ink-faint" aria-hidden="true" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-ink sm:text-3xl">
              {loading ? <Skeleton className="h-8 w-20" /> : (kpis?.totalUsers ?? '—')}
            </div>
            <p className="text-xs text-emerald-600 font-medium mt-1">
              ↑ +{kpis?.newUsersThisMonth ?? 0} this month
            </p>
          </CardContent>
        </Card>

        <Card className="bg-paper-high border-line hover:border-line-strong transition-all shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-ink-mute uppercase tracking-wider">
              <span>Active channels</span>
              <Tv className="h-4 w-4 text-ink-faint" aria-hidden="true" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-ink sm:text-3xl">
              {loading ? <Skeleton className="h-8 w-20" /> : (kpis?.activeChannels ?? '—')}
            </div>
            <p className="text-xs text-emerald-600 font-medium mt-1">
              {kpis?.activeSubscriptions ?? '—'} active subscriptions
            </p>
          </CardContent>
        </Card>

        <Card className="bg-paper-high border-line hover:border-line-strong transition-all shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-ink-mute uppercase tracking-wider">
              <span>Monthly recurring revenue</span>
              <CreditCard className="h-4 w-4 text-ink-faint" aria-hidden="true" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-ink sm:text-3xl">
              {loading ? <Skeleton className="h-8 w-28" /> : (kpis?.mrrFormatted ?? '—')}
            </div>
            <p className="text-xs text-ink-mute mt-1">Calculated from active subscriptions</p>
          </CardContent>
        </Card>

        <Card className="bg-paper-high border-line hover:border-line-strong transition-all shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-ink-mute uppercase tracking-wider">
              <span>Security warnings (30d)</span>
              <ShieldAlert className="h-4 w-4 text-ink-faint" aria-hidden="true" />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-extrabold sm:text-3xl ${
                (kpis?.securityWarnings ?? 0) > 0 ? 'text-amber-600' : 'text-emerald-600'
              }`}
            >
              {loading ? <Skeleton className="h-8 w-16" /> : (kpis?.securityWarnings ?? 0)}
            </div>
            <p className="text-xs text-ink-mute mt-1">Queue backlog: {kpis?.queueBacklog ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* System Health Indicators (live checks) */}
      <Card className="bg-paper-high border-line shadow-xs">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-lg text-ink">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-ink-faint" aria-hidden="true" />
              System &amp; infrastructure health
            </span>
            <Badge variant="default" className="text-xs">
              Live check
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
            {kpis ? (
              (Object.keys(kpis.systemHealth) as (keyof OverviewKPIs['systemHealth'])[]).map((key) => {
                const item = kpis.systemHealth[key];
                return (
                  <div key={key} className="p-4 rounded-xl bg-paper border border-line space-y-1">
                    <div className="text-xs font-medium text-ink-mute">{HEALTH_TITLES[key]}</div>
                    <div
                      className={`text-base font-bold flex items-center gap-2 ${
                        item.ok ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          item.ok ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                      ></span>
                      <span>{item.label}</span>
                    </div>
                    <p className="text-xs text-ink-mute pt-1">
                      {item.ok
                        ? key === 'guardian'
                          ? 'Monitors authentication, rate limits, and lockouts across all routes.'
                          : 'Operating within normal bounds.'
                        : 'Not configured — enable the required setting in the environment file.'}
                    </p>
                  </div>
                );
              })
            ) : (
              <>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="p-4 rounded-xl bg-paper border border-line space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                ))}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contact & Issue Reports Inbox */}
      <Card className="bg-paper-high border-line shadow-xs">
        <CardHeader className="flex flex-col gap-3 border-b border-line pb-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700">
              <Inbox className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base font-bold text-ink">
                Contact &amp; issue reports inbox
              </CardTitle>
              <p className="text-xs text-ink-mute">
                All reports and messages sent by site visitors and clients are saved here in real time.
              </p>
            </div>
          </div>
          <Badge
            variant="default"
            className="shrink-0 self-start bg-paper-low font-mono text-xs text-ink"
          >
            {data?.inquiries?.length ?? 0} messages &amp; reports
          </Badge>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {data?.inquiries && data.inquiries.length > 0 ? (
            <div className="space-y-4">
              {data.inquiries.map((inq) => (
                <div
                  key={inq.id}
                  className="space-y-2 rounded-xl border border-line bg-paper/40 p-3 transition-all hover:bg-paper-low sm:p-4"
                >
                  <div className="flex flex-col gap-2 border-b border-line/60 pb-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-bold text-ink">{inq.name}</span>
                      <span className="break-all font-mono text-xs text-ink-mute">
                        ({inq.email})
                      </span>
                      <Badge
                        variant="default"
                        className="shrink-0 border-red-200 bg-red-50 text-[11px] text-red-700"
                      >
                        {inq.subject}
                      </Badge>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-mute">
                      <span>{new Date(inq.createdAt).toLocaleString('en-US')}</span>
                      <a
                        href={`mailto:${inq.email}?subject=Re: ${encodeURIComponent(inq.subject)}`}
                        className="inline-flex h-10 items-center font-medium text-red-600 hover:underline"
                      >
                        Reply ↗
                      </a>
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink-soft">
                    {inq.message}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-ink-mute">
              No new reports or messages right now.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Admin Modules Quick Launch */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4">
        <Link href={ADMIN_ROUTES.users} className="group block">
          <Card className="h-full border-line bg-paper-high transition-all group-hover:border-ink-faint group-hover:shadow-md">
            <CardContent className="flex items-start gap-4 p-4 sm:p-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                <Users className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-ink transition-colors group-hover:text-blue-600">User management</h3>
                <p className="text-xs text-ink-mute">Search users, view channels, suspend/reactivate accounts.</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href={ADMIN_ROUTES.securityChat} className="group block">
          <Card className="h-full border-line bg-paper-high transition-all group-hover:border-red-400 group-hover:shadow-md">
            <CardContent className="flex items-start gap-4 p-4 sm:p-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-ink transition-colors group-hover:text-red-600">Security guardian chat</h3>
                <p className="text-xs text-ink-mute">Ask the smart security guardian about logins, lockouts, and threats.</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href={ADMIN_ROUTES.auditLogs} className="group block">
          <Card className="h-full border-line bg-paper-high transition-all group-hover:border-amber-400 group-hover:shadow-md">
            <CardContent className="flex items-start gap-4 p-4 sm:p-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <ScrollText className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-ink transition-colors group-hover:text-amber-600">Audit logs</h3>
                <p className="text-xs text-ink-mute">Search the immutable log of all sensitive platform actions.</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href={ADMIN_ROUTES.finance} className="group block">
          <Card className="h-full border-line bg-paper-high transition-all group-hover:border-emerald-400 group-hover:shadow-md">
            <CardContent className="flex items-start gap-4 p-4 sm:p-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <Wallet className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-ink transition-colors group-hover:text-emerald-600">Finance &amp; recurring revenue</h3>
                <p className="text-xs text-ink-mute">Revenue overview, subscription plan breakdown, and churn rate.</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
