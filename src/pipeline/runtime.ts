/**
 * Production wiring: PrismaStore + live provider adapters + DB notifier +
 * bounded page fetching. Tests build the engine with stubs instead — the
 * engine itself never imports Prisma or a vendor SDK.
 */
import { prisma } from "@/lib/db/prisma";
import { fetchWithLimits } from "./checks/links";
import { PipelineEngine, type EngineDeps } from "./engine";
import { createDbNotifier, telegramFromEnv } from "./notifier";
import { PrismaStore } from "./prisma-store";
import { LiveLlm } from "./providers/llm";
import { LiveMedia } from "./providers/media";
import { LiveYouTube, type TokenResolver } from "./providers/youtube";
import type { PageSnapshot } from "./providers/types";

const resolveChannelToken: TokenResolver = async (channelId) => {
  const c = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { accessToken: true, tokenExpiresAt: true },
  });
  if (!c?.accessToken) return null;
  const expired = c.tokenExpiresAt ? c.tokenExpiresAt.getTime() < Date.now() : false;
  return { accessToken: c.accessToken, expired };
};

export const defaultFetchPage = async (url: string): Promise<PageSnapshot> => {
  const res = await fetchWithLimits(url, { wantBody: true, maxBytes: 400_000 });
  return { httpStatus: res.status, contentType: res.contentType, bodyText: res.bodySnippet ?? "" };
};

export function createEngineDeps(overrides: Partial<EngineDeps> = {}): EngineDeps {
  const store = overrides.store ?? new PrismaStore();
  return {
    store,
    llm: overrides.llm ?? new LiveLlm(),
    media: overrides.media ?? new LiveMedia(),
    youtube: overrides.youtube ?? new LiveYouTube(resolveChannelToken),
    notify: overrides.notify ?? createDbNotifier(store, telegramFromEnv()),
    fetchPage: overrides.fetchPage ?? defaultFetchPage,
    now: overrides.now,
    staleMinutes: overrides.staleMinutes,
  };
}

export function createPipelineEngine(overrides: Partial<EngineDeps> = {}): PipelineEngine {
  return new PipelineEngine(createEngineDeps(overrides));
}
