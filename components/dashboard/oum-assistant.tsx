"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { OumAvatar, type OumExpression } from "@/components/marketing/oum-avatar";

interface ChatMessage {
  role: "user" | "oum";
  text: string;
}

const GREETING: ChatMessage = {
  role: "oum",
  text: "Hi! I'm OUM — your AI channel manager. Ask me about channel performance, or send feedback on any video (published or scheduled) and I'll log it for action. Note: your account settings (password, email, billing) are managed manually from the Settings page only.",
};

/**
 * OUM — the floating channel-manager assistant.
 * Pixel-art shell (stepped corners, square bubbles) + the real OUM avatar
 * reacting live: thinking while sending, happy on reply, sad on error.
 */
export function OumAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [mood, setMood] = useState<OumExpression>("normal");
  const bottomRef = useRef<HTMLDivElement>(null);
  const moodTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [open, messages]);

  useEffect(() => () => window.clearTimeout(moodTimer.current), []);

  function setMoodTemp(next: OumExpression, ms: number) {
    window.clearTimeout(moodTimer.current);
    setMood(next);
    moodTimer.current = window.setTimeout(() => setMood("normal"), ms);
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;

    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setSending(true);
    window.clearTimeout(moodTimer.current);
    setMood("confused");

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.reply) {
        setMessages((prev) => [...prev, { role: "oum", text: data.reply }]);
        setMoodTemp("happy", 2500);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "oum",
            text: data.error || "Couldn't get a reply right now. Please try again.",
          },
        ]);
        setMoodTemp("sad", 3000);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "oum", text: "Connection failed. Check your network and try again." },
      ]);
      setMoodTemp("sad", 3000);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Floating launcher */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Open OUM assistant"
        className={cn(
          "fixed bottom-6 right-6 z-[60] flex items-center justify-center overflow-hidden rounded-none shadow-card transition-transform active:scale-95",
          open ? "bg-ink text-paper-high" : "bg-green-600 hover:bg-green-700 px-corners"
        )}
        style={{ height: "3.25rem", width: "3.25rem" }}
      >
        {open ? (
          <X className="h-5 w-5" />
        ) : (
          <span className="pointer-events-none flex h-full w-full items-center justify-center overflow-hidden">
            <OumAvatar interactive={false} animate={false} className="scale-[1.45]" />
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-[60] flex h-[30rem] w-[22rem] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-none bg-paper-high shadow-card px-corners">
          <div
            className="relative flex items-center gap-3 overflow-hidden bg-ink px-4 py-3 text-paper-high"
            style={{
              backgroundImage:
                "repeating-conic-gradient(rgba(255,255,255,0.035) 0% 25%, transparent 0% 50%)",
              backgroundSize: "10px 10px",
            }}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden bg-ink outline outline-2 outline-offset-2 outline-gold-500/60">
              <OumAvatar expression={mood} animate={false} interactive={false} />
            </span>
            <div className="flex-1">
              <p className="font-pixel text-[11px] leading-none text-paper-high">OUM</p>
              <p className="font-pixel mt-2 text-[7px] uppercase tracking-[0.2em] text-gold-400">
                Channel manager
              </p>
            </div>
            <ShieldCheck className="h-4 w-4 text-green-300" aria-label="Account settings are off-limits" />
          </div>
          <div className="px-section-rule-light" aria-hidden="true" />

          <div className="flex-1 space-y-3 overflow-y-auto bg-paper px-3 py-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] rounded-none px-3 py-2 text-xs leading-relaxed",
                  m.role === "user"
                    ? "ml-auto bg-ink text-paper-high"
                    : "mr-auto border border-line bg-paper-high text-ink-soft"
                )}
              >
                {m.text}
              </div>
            ))}
            {sending && (
              <div className="mr-auto flex items-center gap-2 rounded-none border border-line bg-paper-high px-3 py-2 text-xs text-ink-mute">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> OUM is typing...
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="bg-paper-high p-3">
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Message OUM..."
                className="h-10 flex-1 rounded-none border border-line bg-paper px-3 text-xs text-ink placeholder:text-ink-faint focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
              />
              <button
                onClick={send}
                disabled={sending || !input.trim()}
                aria-label="Send"
                className="flex h-10 w-10 items-center justify-center rounded-none bg-green-600 text-paper-high transition-colors hover:bg-green-700 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] text-ink-faint">
              OUM can&apos;t access your account settings or payment data — those are managed manually only.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
