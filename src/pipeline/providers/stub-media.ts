/**
 * Stub media gateway for tests: real orchestration, fake bytes.
 * Each method records the request and returns a configurable GeneratedAsset,
 * so stage code paths (cost guard -> generate -> asset row -> rightss checks)
 * are exercised exactly like production, offline.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { GeneratedAsset, MediaGateway } from "./types";

export interface StubMediaOptions {
  configured?: boolean;
  reason?: string;
  costCentsPerAsset?: number;
  filePathPrefix?: string;
}

export class StubMedia implements MediaGateway {
  readonly calls: Array<{ method: string; purpose: string }> = [];
  constructor(private opts: StubMediaOptions = {}) {}

  name(): string {
    return "stub-media";
  }

  isConfigured(): boolean {
    return this.opts.configured ?? true;
  }

  reason(): string {
    return this.opts.reason ?? "stub media for tests";
  }

  private asset(method: string, purpose: string, extra: Partial<GeneratedAsset> = {}): GeneratedAsset {
    this.calls.push({ method, purpose });
    const prefix = this.opts.filePathPrefix ?? "/tmp/opencode/oum-stub";
    const filePath = `${prefix}/${purpose.replace(/[^a-zA-Z0-9_-]/g, "_")}.${method === "synthesizeVoice" ? "mp3" : method === "render" ? "mp4" : "png"}`;
    // write real bytes so downstream file-existence checks behave like prod
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, Buffer.alloc(1024, 1));
    return {
      filePath,
      bytes: 1024,
      mimeType: method === "synthesizeVoice" ? "audio/mpeg" : method === "render" ? "video/mp4" : "image/png",
      provider: "stub-media",
      costCents: this.opts.costCentsPerAsset ?? 1,
      width: method === "render" ? 1080 : 1024,
      height: method === "render" ? 1920 : 1024,
      ...extra,
    };
  }

  async generateImage(req: { prompt: string; aspect: "16:9" | "9:16"; purpose: string }): Promise<GeneratedAsset> {
    return this.asset("generateImage", req.purpose);
  }

  async generateVideo(req: { prompt: string; seconds: number; aspect: "16:9" | "9:16"; purpose: string }): Promise<GeneratedAsset> {
    return this.asset("generateVideo", req.purpose, { durationSec: req.seconds });
  }

  async synthesizeVoice(req: { text: string; style: string; rateWpm: number; purpose: string }): Promise<GeneratedAsset> {
    return this.asset("synthesizeVoice", req.purpose);
  }

  async render(req: { editList: unknown; purpose: string }): Promise<GeneratedAsset> {
    const total = (req.editList as { totalSeconds?: number } | null)?.totalSeconds ?? 60;
    return this.asset("render", req.purpose, { durationSec: total });
  }
}
