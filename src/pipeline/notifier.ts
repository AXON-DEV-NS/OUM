/**
 * Notifications: ALWAYS write an in-app row; best-effort Telegram copy.
 * A failed Telegram send must never fail the run — the row is the record.
 */
import type { PipelineStore } from "./store";
import type { NotifierFn } from "./providers/types";

export interface TelegramConfig {
  token: string;
  chatId: string;
}

export function createDbNotifier(store: PipelineStore, telegram: TelegramConfig | null = null, log = console): NotifierFn {
  return async (n) => {
    await store.addNotification({
      userId: n.userId,
      runId: n.runId,
      channel: "in_app",
      kind: n.kind,
      title: n.title,
      body: n.body,
      data: n.data,
    });
    log.log(`[notify:${n.kind}] ${n.title} — ${n.body.slice(0, 160)}`);
    if (telegram) {
      try {
        const res = await fetch(`https://api.telegram.org/bot${telegram.token}/sendMessage`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chat_id: telegram.chatId, text: `*${n.title}*\n${n.body}`.slice(0, 4000), parse_mode: "Markdown" }),
        });
        if (!res.ok) log.warn(`[notify] telegram failed: ${res.status}`);
      } catch (e) {
        log.warn(`[notify] telegram error: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  };
}

export function telegramFromEnv(env: NodeJS.ProcessEnv = process.env): TelegramConfig | null {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  return token && chatId ? { token, chatId } : null;
}
