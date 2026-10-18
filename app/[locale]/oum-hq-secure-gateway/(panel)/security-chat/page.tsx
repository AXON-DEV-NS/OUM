'use client';

import React, { useEffect, useState, useRef } from 'react';
import { ShieldCheck, Send } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface ChatMessage {
  id: string;
  sender: 'admin' | 'guardian';
  message: string;
  createdAt: string;
}

const QUICK_PROMPTS = [
  'Is there any suspicious login activity today?',
  'Show accounts with repeated failed magic-link attempts',
  'Show recent lockouts and rate-limit events',
  'Summarize the platform security health',
];

/**
 * Minimal, XSS-safe inline formatting for guardian replies: **bold** and
 * `code`. Everything else is rendered as plain text (React escapes it).
 */
function renderGuardianMessage(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  text.split(/(\*\*[^*]+\*\*)/g).forEach((chunk, i) => {
    if (chunk.startsWith('**') && chunk.endsWith('**') && chunk.length > 4) {
      out.push(
        <strong key={`b${i}`} className="font-semibold">
          {chunk.slice(2, -2)}
        </strong>
      );
      return;
    }
    chunk.split(/(`[^`]+`)/g).forEach((sub, j) => {
      if (sub.startsWith('`') && sub.endsWith('`') && sub.length > 2) {
        out.push(
          <code key={`c${i}-${j}`} className="rounded bg-paper-low px-1 py-0.5 font-mono text-[0.85em] text-ink">
            {sub.slice(1, -1)}
          </code>
        );
      } else if (sub) {
        out.push(sub);
      }
    });
  });
  return out;
}

export default function SecurityChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [guardianActive, setGuardianActive] = useState<boolean>(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    fetch('/api/admin/security-chat')
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.guardianActive === 'boolean') {
          setGuardianActive(data.guardianActive);
        }
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
        } else {
          setMessages([
            {
              id: 'init_1',
              sender: 'guardian',
              message: data.guardianActive
                ? '🛡️ **The smart security guardian is online**. I monitor authentication points, magic-link logs, rate limits, lockouts, and audit events. Ask me anything about the security posture or suspicious activity.'
                : '⚠️ **Alert: the AI security guardian is currently offline**. No AI key (DeepSeek API Key) has been provided. Please add and activate the key in the .env.local file so the guardian can operate at full capacity.',
              createdAt: new Date().toISOString(),
            },
          ]);
        }
      })
      .catch((err) => {
        console.error('Failed to load chat history:', err);
      });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || input.trim();
    if (!query || loading) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'admin',
      message: query,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/security-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to query Security Guardian');

      const guardianMsg: ChatMessage = {
        id: `guardian_${Date.now()}`,
        sender: 'guardian',
        message: data.reply,
        createdAt: data.timestamp || new Date().toISOString(),
      };

      setMessages((prev) => [...prev, guardianMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: 'guardian',
          message: `⚠️ **Error communicating with the guardian**: ${err.message}`,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-ink sm:text-2xl">Smart security guardian chat</h1>
            <Badge
              variant="default"
              className={
                guardianActive
                  ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                  : "bg-amber-100 text-amber-800 border-amber-200"
              }
            >
              {guardianActive ? "Live monitoring (active)" : "Offline — waiting for AI key"}
            </Badge>
          </div>
          <p className="text-sm text-ink-mute">
            Ask in natural language about real authentication events, rate limits, lockouts, and audit logs.
          </p>
        </div>
      </div>

      {/* Chat Container */}
      <Card className="bg-paper-high border-line shadow-md flex h-[70dvh] min-h-[420px] flex-col sm:h-[650px]">
        {/* Chat History Header */}
        <CardHeader className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-paper/50 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-600 text-paper-high">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm text-ink font-bold">Guardian system console</CardTitle>
              <span className="block text-xs text-ink-mute">
                {guardianActive
                  ? "Connected to security event streams and audit logs"
                  : "Offline — waiting for the AI key (DeepSeek API Key) to be provided and activated"}
              </span>
            </div>
          </div>

          <div className="hidden shrink-0 font-mono text-xs text-ink-mute sm:block">
            {messages.length} messages in memory
          </div>
        </CardHeader>

        {/* Message Thread */}
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-paper/30 sm:p-6">
          {messages.map((msg) => {
            const isGuardian = msg.sender === 'guardian';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isGuardian ? 'justify-start' : 'justify-end'}`}
              >
                {isGuardian && (
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-paper-high shadow-xs">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] min-w-0 rounded-2xl p-4 text-sm leading-relaxed sm:max-w-[75%] ${
                    isGuardian
                      ? 'bg-paper-high border border-line text-ink shadow-xs'
                      : 'bg-ink text-paper-high shadow-xs'
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words overflow-wrap-anywhere">
                    {renderGuardianMessage(msg.message)}
                  </div>
                  <div
                    className={`text-[10px] mt-2 ${
                      isGuardian ? 'text-ink-mute' : 'text-line-strong'
                    } text-right font-mono`}
                  >
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                {!isGuardian && (
                  <div className="w-8 h-8 rounded-full bg-red-600 text-paper-high flex items-center justify-center text-xs font-bold shrink-0 mt-1 shadow-xs">
                    AD
                  </div>
                )}
              </div>
            );
          })}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-paper-high">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="bg-paper-high border border-line rounded-2xl p-4 text-sm text-ink-mute flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-ink-faint animate-ping"></span>
                <span>The guardian is analyzing security logs and database events...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </CardContent>

        {/* Quick Prompts Bar */}
        <div className="flex items-center gap-2 overflow-x-auto border-t border-line bg-paper px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-6">
          <span className="text-xs font-semibold text-ink-mute shrink-0">Quick queries:</span>
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => handleSend(prompt)}
              disabled={loading}
              className="h-10 shrink-0 whitespace-nowrap rounded-full border border-line bg-paper-high px-3 text-xs text-ink-soft shadow-xs transition-colors hover:bg-line disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input Footer */}
        <CardFooter className="border-t border-line bg-paper-high p-3 sm:p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
          >
            <div className="min-w-0 flex-1">
              <Input
                type="text"
                aria-label="Ask the security guardian"
                placeholder="Ask the guardian about login anomalies, rate limits, audit logs..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="text-sm placeholder:text-ink-mute focus:border-red-500"
                disabled={loading}
              />
            </div>
            <Button
              type="submit"
              variant="green"
              className="h-10 w-full shrink-0 bg-ink px-5 text-paper-high hover:bg-ink-soft sm:w-auto"
              disabled={loading || !input.trim()}
            >
              {loading ? (
                'Analyzing...'
              ) : (
                <>
                  <Send className="h-4 w-4 sm:hidden" aria-hidden="true" />
                  <span className="sm:hidden">Send</span>
                  <span className="hidden sm:inline">Ask the guardian</span>
                </>
              )}
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
