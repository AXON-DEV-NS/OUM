'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Database,
  Loader2,
  ShieldCheck,
  Terminal,
  X,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Step {
  tool: string;
  kind: 'read' | 'write';
  input: unknown;
  ok: boolean;
  result?: unknown;
  error?: string;
  ms: number;
}

interface Pending {
  token: string;
  tool: string;
  input: unknown;
  description: string;
  destructive: boolean;
  expiresAt: string;
}

interface Msg {
  id: string;
  role: 'owner' | 'operator' | 'system';
  text: string;
  steps?: Step[];
  pending?: Pending;
  resolved?: 'confirmed' | 'cancelled';
  result?: unknown;
}

const QUICK_COMMANDS = [
  'Give me a full platform health and revenue report.',
  'List the newest users and flag any suspended accounts.',
  'Create a promo code SUMMER20 for 20% off, 200 uses.',
  'Show the latest pipeline runs and their status.',
  'SQL: SELECT status, count(*) AS n FROM runs GROUP BY status ORDER BY n DESC',
];

/** Minimal, XSS-safe inline formatting: **bold** and `code`. */
function renderRichText(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  text.split(/(\*\*[^*]+\*\*)/g).forEach((chunk, i) => {
    if (chunk.startsWith('**') && chunk.endsWith('**') && chunk.length > 4) {
      out.push(
        <strong key={`b${i}`} className="font-semibold">
          {chunk.slice(2, -2)}
        </strong>,
      );
      return;
    }
    chunk.split(/(`[^`]+`)/g).forEach((sub, j) => {
      if (sub.startsWith('`') && sub.endsWith('`') && sub.length > 2) {
        out.push(
          <code key={`c${i}-${j}`} className="rounded bg-paper-low px-1 py-0.5 font-mono text-[0.85em] text-ink">
            {sub.slice(1, -1)}
          </code>,
        );
      } else if (sub) {
        out.push(sub);
      }
    });
  });
  return out;
}

function pretty(value: unknown, max = 5000): string {
  try {
    const s = JSON.stringify(value, null, 2);
    return s.length > max ? `${s.slice(0, max)}\n…[truncated]` : s;
  } catch {
    return String(value);
  }
}

function StepList({ steps }: { steps: Step[] }) {
  if (!steps.length) return null;
  return (
    <div className="mt-2 space-y-1.5">
      {steps.map((step, i) => (
        <details key={`${step.tool}-${i}`} className="rounded-lg border border-line bg-paper/70 px-2.5 py-1.5 text-xs">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-ink-soft">
            {step.ok ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
            ) : (
              <X className="h-3.5 w-3.5 shrink-0 text-red-600" aria-hidden="true" />
            )}
            <span className="font-mono font-semibold">{step.tool}</span>
            <span className="text-ink-mute">{step.kind === 'read' ? 'read' : 'write'}</span>
            <span className="ml-auto font-mono text-[10px] text-ink-mute">{step.ms} ms</span>
          </summary>
          {step.error ? (
            <p className="mt-1.5 break-words text-red-700">{step.error}</p>
          ) : (
            <pre className="mt-1.5 max-h-56 overflow-auto rounded bg-ink p-2 font-mono text-[11px] leading-relaxed text-emerald-400">
              {pretty(step.result)}
            </pre>
          )}
        </details>
      ))}
    </div>
  );
}

export default function AdminOperatorPage() {
  const [online, setOnline] = useState<boolean | null>(null);
  const [model, setModel] = useState<string>('deepseek-chat');
  const [owner, setOwner] = useState<string>('');
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: 'welcome',
      role: 'operator',
      text:
        '**Owner operator ready.** I can inspect users, plans, finance, audit logs, pipeline runs and the database (read-only SQL), and I can execute platform changes. Every write waits for your signed confirmation. What should I do?',
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/admin/operator')
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.online === 'boolean') setOnline(d.online);
        if (typeof d.model === 'string') setModel(d.model);
        if (typeof d.owner === 'string') setOwner(d.owner);
      })
      .catch(() => setOnline(false));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  const append = (msg: Omit<Msg, 'id'>) => {
    setMessages((prev) => [...prev, { ...msg, id: crypto.randomUUID() }]);
  };

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || busy || online === false) return;
    const history = messages
      .filter((m) => m.role === 'owner' || m.role === 'operator')
      .slice(-12)
      .map((m) => ({ role: m.role as 'owner' | 'operator', content: m.text }));

    append({ role: 'owner', text });
    setInput('');
    setBusy(true);
    try {
      const res = await fetch('/api/admin/operator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      append({
        role: 'operator',
        text: data.reply || '(no reply)',
        steps: Array.isArray(data.steps) ? data.steps : [],
        pending: data.pending,
      });
    } catch (err) {
      append({ role: 'system', text: err instanceof Error ? err.message : 'The operator request failed.' });
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (msgId: string, pending: Pending) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/operator/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: pending.token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Confirmation failed (${res.status})`);
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, resolved: 'confirmed', result: data.result } : m)));
      append({
        role: 'system',
        text: `Executed **${data.tool}** with your signed confirmation.`,
        result: data.result,
      });
    } catch (err) {
      append({ role: 'system', text: err instanceof Error ? err.message : 'The confirmation failed.' });
    } finally {
      setBusy(false);
    }
  };

  const cancel = (msgId: string) => {
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, resolved: 'cancelled' } : m)));
    append({ role: 'system', text: 'Action cancelled — nothing was executed.' });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-ink sm:text-2xl">Owner operator</h1>
            <Badge variant="default" className="border-red-200 bg-red-50 text-red-700">
              Owner only · full authority
            </Badge>
            <Badge
              variant="default"
              className={
                online === true
                  ? 'border-emerald-200 bg-emerald-100 text-emerald-800'
                  : online === false
                    ? 'border-amber-200 bg-amber-100 text-amber-800'
                    : 'border-line bg-paper-low text-ink-mute'
              }
            >
              {online === true ? `${model} online` : online === false ? 'Model offline' : 'Checking model…'}
            </Badge>
          </div>
          <p className="text-sm text-ink-mute">
            Reads run instantly. Writes wait for your signed confirmation. No one else can reach this console, and
            every action is written to the immutable audit log.
          </p>
        </div>
      </div>

      {online === false && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">The operator needs a model key.</p>
            <p className="text-xs">
              Add <code className="rounded bg-paper-low px-1 text-ink">DEEPSEEK_API_KEY</code> in Vercel → Settings →
              Environment Variables (Production), then redeploy. The console stays read-only until then.
            </p>
          </div>
        </div>
      )}

      {/* Console */}
      <Card className="flex h-[72dvh] min-h-[460px] flex-col border-line bg-paper-high shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-paper/50 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink text-paper-high">
              <Terminal className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink">Operator console</p>
              <p className="text-xs text-ink-mute">
                Owner session only · reads instant · writes require your click
              </p>
            </div>
          </div>
          <div className="hidden shrink-0 items-center gap-1.5 font-mono text-[11px] text-ink-mute sm:flex">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            audited · signed confirmations
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto bg-paper/30 p-4 sm:p-6" aria-live="polite">
          {messages.map((msg) => {
            if (msg.role === 'owner') {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl bg-ink p-4 text-sm text-paper-high shadow-xs sm:max-w-[75%]">
                    <div className="whitespace-pre-wrap break-words">{msg.text}</div>
                  </div>
                </div>
              );
            }
            if (msg.role === 'system') {
              return (
                <div key={msg.id} className="flex justify-center">
                  <div className="max-w-[92%] rounded-xl border border-line bg-paper-high px-3 py-2 text-center text-xs text-ink-soft">
                    {renderRichText(msg.text)}
                    {msg.result !== undefined && (
                      <details className="mt-2 text-left">
                        <summary className="cursor-pointer text-[11px] font-semibold text-ink-mute">Result</summary>
                        <pre className="mt-1.5 max-h-56 overflow-auto rounded bg-ink p-2 font-mono text-[11px] text-emerald-400">
                          {pretty(msg.result)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              );
            }
            return (
              <div key={msg.id} className="flex gap-3">
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-paper-high">
                  <Terminal className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 max-w-[92%] flex-1">
                  <div className="rounded-2xl border border-line bg-paper-high p-4 text-sm leading-relaxed text-ink shadow-xs">
                    <div className="whitespace-pre-wrap break-words">{renderRichText(msg.text)}</div>
                    {msg.steps && msg.steps.length > 0 && <StepList steps={msg.steps} />}
                  </div>

                  {msg.pending && (
                    <div
                      className={`mt-2 rounded-xl border-2 p-3 ${
                        msg.pending.destructive ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50'
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <AlertTriangle
                          className={`h-4 w-4 ${msg.pending.destructive ? 'text-red-600' : 'text-amber-700'}`}
                          aria-hidden="true"
                        />
                        <span className="text-sm font-bold text-ink">
                          {msg.pending.destructive ? 'Destructive action — confirm' : 'Confirmation required'}
                        </span>
                        <code className="rounded bg-paper-high px-1.5 py-0.5 font-mono text-[11px] text-ink-soft">
                          {msg.pending.tool}
                        </code>
                      </div>
                      <p className="mt-1 text-xs text-ink-soft">{msg.pending.description}</p>
                      <pre className="mt-2 max-h-40 overflow-auto rounded bg-paper-high p-2 font-mono text-[11px] text-ink-soft">
                        {pretty(msg.pending.input, 2500)}
                      </pre>

                      {msg.resolved ? (
                        <p className="mt-2 text-xs font-semibold text-ink-mute">
                          {msg.resolved === 'confirmed' ? '✓ Executed and audited.' : 'Cancelled — nothing was executed.'}
                        </p>
                      ) : (
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                          <Button
                            variant={msg.pending.destructive ? 'danger' : 'green'}
                            className="h-10 w-full sm:w-auto"
                            disabled={busy}
                            onClick={() => confirm(msg.id, msg.pending!)}
                          >
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm & execute'}
                          </Button>
                          <Button
                            variant="secondary"
                            className="h-10 w-full sm:w-auto"
                            disabled={busy}
                            onClick={() => cancel(msg.id)}
                          >
                            Cancel
                          </Button>
                          <span className="self-center font-mono text-[10px] text-ink-mute">
                            signed for {owner || 'owner'} · expires {new Date(msg.pending.expiresAt).toLocaleTimeString('en-US')}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {busy && (
            <div className="flex items-center gap-2 text-xs text-ink-mute">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Working…
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t border-line bg-paper px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="shrink-0 text-xs font-semibold text-ink-mute">Try:</span>
            {QUICK_COMMANDS.map((q) => (
              <button
                key={q}
                type="button"
                disabled={busy || online === false}
                onClick={() => send(q)}
                className="h-10 shrink-0 whitespace-nowrap rounded-full border border-line bg-paper-high px-3 text-left text-xs text-ink-soft transition-colors hover:bg-line disabled:opacity-50"
              >
                {q.length > 64 ? `${q.slice(0, 64)}…` : q}
              </button>
            ))}
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="border-t border-line bg-paper-high p-3 sm:p-4"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="min-w-0 flex-1">
              <Input
                aria-label="Command for the owner operator"
                placeholder="Tell the operator what to do — e.g. suspend user X, create a promo code, run a read-only SQL query…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={busy || online === false}
                className="text-sm placeholder:text-ink-mute"
              />
            </div>
            <Button
              type="submit"
              variant="green"
              className="h-10 w-full shrink-0 bg-ink px-5 text-paper-high hover:bg-ink-soft sm:w-auto"
              disabled={busy || online === false || !input.trim()}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Execute'}
            </Button>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-mute">
            <Database className="h-3 w-3 shrink-0" aria-hidden="true" />
            Read results are processed by the configured model provider. SQL is read-only and credential columns are
            redacted. Writes execute only after your signed confirmation.
          </p>
        </form>
      </Card>
    </div>
  );
}
