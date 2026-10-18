/**
 * Live YouTube adapter (Data API v3, resumable upload).
 *
 * Private-first is enforced in code: uploadPrivate only ever sets
 * privacyStatus=private; scheduling flips it to private+publishAt; going
 * public is a separate, explicit call.
 *
 * STATUS: cannot be exercised live in this environment (no OAuth tokens), so
 * it is unit-tested through a stub gateway only. Treat as unverified-live.
 */
import { readFile } from "node:fs/promises";
import { CONFIG } from "../config";
import { providerMissing, upstreamError } from "../errors";
import type { ChannelToken, UploadSpec, VideoStatus, YoutubeGateway } from "./types";

const API = "https://www.googleapis.com/youtube/v3";
const UPLOAD = "https://www.googleapis.com/upload/youtube/v3/videos";
const MAX_UPLOAD_BYTES = 256 * 1024 * 1024;

export type TokenResolver = (channelId: string) => Promise<ChannelToken | null>;

export class LiveYouTube implements YoutubeGateway {
  constructor(private resolveToken: TokenResolver) {}

  private async token(channelId: string): Promise<string> {
    const t = await this.resolveToken(channelId);
    if (!t) throw providerMissing(`channel ${channelId} has no YouTube token — reconnect the channel`);
    if (t.expired) throw providerMissing(`channel ${channelId} YouTube token expired — reconnect the channel`);
    return t.accessToken;
  }

  async configured(channelId: string): Promise<{ ok: boolean; reason?: string }> {
    const t = await this.resolveToken(channelId);
    if (!t) return { ok: false, reason: "channel has no YouTube OAuth token" };
    if (t.expired) return { ok: false, reason: "YouTube token expired — reconnect the channel" };
    return { ok: true };
  }

  async quotaUsed(): Promise<number> {
    // Wave 2: persist quota usage per day (systemSetting youtube:quota:<date>).
    return 0;
  }

  async uploadPrivate(spec: UploadSpec): Promise<{ videoId: string }> {
    const token = await this.token(spec.channelId);
    const bytes = await readFile(spec.filePath);
    if (bytes.byteLength === 0) throw upstreamError(`upload file empty: ${spec.filePath}`);
    if (bytes.byteLength > MAX_UPLOAD_BYTES) throw upstreamError(`upload file too large (${bytes.byteLength} bytes, max ${MAX_UPLOAD_BYTES})`);

    const metadata = {
      snippet: {
        title: spec.title,
        description: spec.description,
        tags: spec.tags,
        categoryId: spec.categoryId ?? "22",
      },
      status: {
        privacyStatus: "private",
        madeForKids: spec.madeForKids,
        selfDeclaredMadeForKids: false,
        ...(spec.disclosure.altered ? { containsSyntheticMedia: true } : {}),
      },
    };

    const init = await fetch(`${UPLOAD}?uploadType=resumable&part=snippet,status`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json; charset=UTF-8",
        "x-upload-content-type": "video/*",
        "x-upload-content-length": String(bytes.byteLength),
      },
      body: JSON.stringify(metadata),
    });
    if (init.status === 401 || init.status === 403) throw providerMissing(`YouTube rejected credentials (${init.status})`);
    if (!init.ok) throw upstreamError(`YouTube upload init failed: ${init.status} ${(await init.text()).slice(0, 300)}`);
    const location = init.headers.get("location");
    if (!location) throw upstreamError("YouTube did not return a resumable upload location");

    const put = await fetch(location, {
      method: "PUT",
      headers: { "content-type": "video/*", "content-length": String(bytes.byteLength) },
      body: new Uint8Array(bytes),
    });
    if (!put.ok) throw upstreamError(`YouTube upload failed: ${put.status} ${(await put.text()).slice(0, 300)}`);
    const out = (await put.json()) as { id?: string };
    if (!out.id) throw upstreamError("YouTube upload returned no video id");
    return { videoId: out.id };
  }

  async setScheduled(videoId: string, at: Date): Promise<void> {
    const token = await this.tokenByVideo(videoId);
    const res = await fetch(`${API}/videos?part=status`, {
      method: "PUT",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ id: videoId, status: { privacyStatus: "private", publishAt: at.toISOString() } }),
    });
    if (!res.ok) throw upstreamError(`YouTube schedule failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  }

  async setPublic(videoId: string): Promise<void> {
    const token = await this.tokenByVideo(videoId);
    const res = await fetch(`${API}/videos?part=status`, {
      method: "PUT",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ id: videoId, status: { privacyStatus: "public" } }),
    });
    if (!res.ok) throw upstreamError(`YouTube publish failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  }

  async videoStatus(videoId: string): Promise<VideoStatus> {
    const token = await this.tokenByVideo(videoId);
    const res = await fetch(`${API}/videos?part=status,snippet&id=${encodeURIComponent(videoId)}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw upstreamError(`YouTube status failed: ${res.status}`);
    const json = (await res.json()) as { items?: Array<{ snippet?: { title?: string }; status?: { uploadStatus?: string; privacyStatus?: string } }> };
    const item = json.items?.[0];
    return {
      state: item?.status?.uploadStatus ?? "unknown",
      privacy: item?.status?.privacyStatus ?? null,
      publicUrl: item ? `https://www.youtube.com/watch?v=${videoId}` : null,
    };
  }

  /**
   * Per-video calls need the issuing channel's token. Wave 1 stores the
   * channel id in the run; runtime wires the resolver with the run's channel.
   */
  private async tokenByVideo(videoId: string): Promise<string> {
    const t = await this.resolveToken(`video:${videoId}`);
    if (!t) throw providerMissing(`no YouTube token available for video ${videoId}`);
    if (t.expired) throw providerMissing("YouTube token expired — reconnect the channel");
    return t.accessToken;
  }
}

export const YOUTUBE = { uploadCostUnits: 1600, columnsQuota: CONFIG.retention.backupFiles };
