/**
 * Media gateway (image/video generation, TTS, render).
 *
 * Wave 1 status: the PORT and the gates exist; no vendor adapter is wired yet,
 * so `isConfigured()` returns false and every media-tier stage parks cheaply
 * with an explicit reason instead of burning money. The whole pipeline is
 * exercisable up to and including S8 QA on text artifacts alone (Fail Early).
 */
import { providerMissing } from "../errors";
import type { GeneratedAsset, MediaGateway } from "./types";

/** every generation call fails cheaply until a real adapter is wired */
const notWired = (what: string): never => {
  throw providerMissing(`media:${what}`);
};

export class LiveMedia implements MediaGateway {
  name(): string {
    return "media";
  }

  isConfigured(): boolean {
    // Wave 2: return true when an adapter key (image/video/TTS) is present.
    return false;
  }

  reason(): string {
    return "media providers not wired yet (wave 2): image/video/TTS adapters pending; stages S5-S6 park here by design";
  }

  async generateImage(): Promise<GeneratedAsset> {
    return notWired("generateImage");
  }

  async generateVideo(): Promise<GeneratedAsset> {
    return notWired("generateVideo");
  }

  async synthesizeVoice(): Promise<GeneratedAsset> {
    return notWired("synthesizeVoice");
  }

  async render(): Promise<GeneratedAsset> {
    return notWired("render");
  }
}
