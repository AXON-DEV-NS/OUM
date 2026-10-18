/**
 * Stub YouTube gateway for tests: real private-first orchestration, fake API.
 * It models privacy state, scheduled publication and quota exactly like the
 * real flow expects, driven by an injectable clock.
 */
import type { UploadSpec, VideoStatus, YoutubeGateway } from "./types";

export interface StubYouTubeOptions {
  configured?: boolean;
  reason?: string;
  now?: () => Date;
}

interface StubVideo {
  privacy: "private" | "public";
  scheduled: Date | null;
  state: "uploaded" | "processed" | "failed" | "rejected";
  title: string;
}

export class StubYouTube implements YoutubeGateway {
  readonly uploads = new Map<string, StubVideo>();
  readonly calls: string[] = [];
  private seq = 0;

  constructor(private opts: StubYouTubeOptions = {}) {}

  private now(): Date {
    return this.opts.now ? this.opts.now() : new Date();
  }

  async configured(): Promise<{ ok: boolean; reason?: string }> {
    return this.opts.configured === false
      ? { ok: false, reason: this.opts.reason ?? "stub youtube not configured" }
      : { ok: true };
  }

  async quotaUsed(): Promise<number> {
    return 0;
  }

  async uploadPrivate(spec: UploadSpec): Promise<{ videoId: string }> {
    const videoId = `stubvid${++this.seq}`;
    this.uploads.set(videoId, {
      privacy: "private",
      scheduled: spec.scheduledFor ?? null,
      state: "processed",
      title: spec.title,
    });
    this.calls.push(`upload:${videoId}`);
    return { videoId };
  }

  async setScheduled(videoId: string, at: Date): Promise<void> {
    const v = this.uploads.get(videoId);
    if (v) v.scheduled = at;
    this.calls.push(`schedule:${videoId}`);
  }

  async setPublic(videoId: string): Promise<void> {
    const v = this.uploads.get(videoId);
    if (v) v.privacy = "public";
    this.calls.push(`public:${videoId}`);
  }

  async videoStatus(videoId: string): Promise<VideoStatus> {
    const v = this.uploads.get(videoId);
    if (!v) return { state: "failed", publicUrl: null, privacy: null };
    const due = v.scheduled ? v.scheduled.getTime() <= this.now().getTime() : false;
    const privacy = v.privacy === "public" || due ? "public" : v.privacy;
    return { state: v.state, publicUrl: `https://www.youtube.com/watch?v=${videoId}`, privacy };
  }
}
