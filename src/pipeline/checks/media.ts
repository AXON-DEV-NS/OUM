/**
 * Media probing via ffprobe/ffmpeg when installed.
 *
 * The environment may not ship ffmpeg (this repo's dev box does not), so every
 * media check returns `skipped` — never a bogus pass — when the tool is
 * missing. Once a renderer exists, the same checks run unchanged.
 */
import { spawnSync } from "node:child_process";
import { statSync } from "node:fs";
import { CONFIG } from "@/src/pipeline/config";
import { fail, ok, skip, warn, type CheckOutcome, type DeterministicCheck } from "./index";

export interface ProbeResult {
  available: boolean;
  reason?: string;
  durationSec?: number;
  width?: number;
  height?: number;
  hasAudio?: boolean;
  hasVideo?: boolean;
  loudnessLufs?: number | null;
  sizeBytes?: number;
}

function which(bin: string): boolean {
  const r = spawnSync("which", [bin], { encoding: "utf8" });
  return r.status === 0 && r.stdout.trim().length > 0;
}

export function ffprobeAvailable(): boolean {
  return which("ffprobe");
}

export function probeMedia(filePath: string): ProbeResult {
  if (!ffprobeAvailable()) return { available: false, reason: "ffprobe not installed" };
  try {
    if (!statSync(filePath).isFile()) return { available: false, reason: "file not found" };
  } catch {
    return { available: false, reason: "file not found" };
  }
  const r = spawnSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", filePath], {
    encoding: "utf8",
    timeout: 30_000,
  });
  if (r.status !== 0) return { available: false, reason: `ffprobe failed: ${r.stderr?.slice(0, 200)}` };
  try {
    const json = JSON.parse(r.stdout) as {
      format?: { duration?: string; size?: string };
      streams?: Array<{ codec_type?: string; width?: number; height?: number }>;
    };
    const streams = json.streams ?? [];
    const video = streams.find((s) => s.codec_type === "video");
    return {
      available: true,
      durationSec: json.format?.duration ? Number(json.format.duration) : undefined,
      sizeBytes: json.format?.size ? Number(json.format.size) : undefined,
      width: video?.width,
      height: video?.height,
      hasVideo: !!video,
      hasAudio: streams.some((s) => s.codec_type === "audio"),
    };
  } catch (e) {
    return { available: false, reason: `ffprobe output unparsable: ${e instanceof Error ? e.message : e}` };
  }
}

/** EBU R128 integrated loudness via ffmpeg loudnorm (pass 1, analysis only). */
export function measureLoudness(filePath: string): { available: boolean; lufs?: number; reason?: string } {
  if (!which("ffmpeg")) return { available: false, reason: "ffmpeg not installed" };
  const r = spawnSync("ffmpeg", ["-hide_banner", "-i", filePath, "-af", "loudnorm=print_format=json", "-f", "null", "-"], {
    encoding: "utf8",
    timeout: 120_000,
  });
  const match = `${r.stderr ?? ""}`.match(/"input_i"\s*:\s*"?(-?\d+(?:\.\d+)?)"?/);
  if (!match) return { available: false, reason: "loudnorm produced no measurement" };
  return { available: true, lufs: Number(match[1]) };
}

// ── Check objects ────────────────────────────────────────────────

export const checkMediaPresent: DeterministicCheck<{ filePath: string | null }> = {
  key: "media.file",
  run({ filePath }): CheckOutcome {
    if (!filePath) return fail("media.file", "no media file recorded for this artifact");
    try {
      const st = statSync(filePath);
      if (!st.isFile() || st.size === 0) return fail("media.file", `media file empty or missing: ${filePath}`);
      return ok("media.file", `${Math.round(st.size / 1024)} KB`);
    } catch {
      return fail("media.file", `media file missing on disk: ${filePath}`);
    }
  },
};

export const checkVideoResolution: DeterministicCheck<{ probe: ProbeResult }> = {
  key: "media.resolution",
  run({ probe }): CheckOutcome {
    if (!probe.available) return skip("media.resolution", probe.reason ?? "probe unavailable");
    if (!probe.hasVideo || !probe.width || !probe.height) return fail("media.resolution", "no video stream found");
    const shortSide = Math.min(probe.width, probe.height);
    if (shortSide < CONFIG.video.minShortSide) {
      return fail("media.resolution", `short side ${shortSide}px < ${CONFIG.video.minShortSide}px`, { fix: "re-render at 1080p or higher" });
    }
    return ok("media.resolution", `${probe.width}x${probe.height}`);
  },
};

export const checkVideoDuration: DeterministicCheck<{ probe: ProbeResult; expectedSec: number }> = {
  key: "media.duration",
  run({ probe, expectedSec }): CheckOutcome {
    if (!probe.available) return skip("media.duration", probe.reason ?? "probe unavailable");
    if (!probe.durationSec || expectedSec <= 0) return fail("media.duration", "duration could not be measured");
    const diff = Math.abs(probe.durationSec - expectedSec) / expectedSec;
    if (diff > CONFIG.video.durationTolerancePct) {
      return warn("media.duration", `rendered ${probe.durationSec.toFixed(1)}s vs planned ${expectedSec}s (±${Math.round(diff * 100)}%)`);
    }
    return ok("media.duration", `${probe.durationSec.toFixed(1)}s`);
  },
};

export const checkLoudness: DeterministicCheck<{ lufs: number | null | undefined }> = {
  key: "media.loudness",
  run({ lufs }): CheckOutcome {
    if (lufs === null || lufs === undefined) return skip("media.loudness", "no loudness measurement (renderer not available yet)");
    const { target, tolerance } = CONFIG.lufs;
    if (Math.abs(lufs - target) > tolerance) {
      return fail("media.loudness", `integrated loudness ${lufs.toFixed(1)} LUFS outside ${target}±${tolerance}`, { fix: `normalize audio to ${target} LUFS` });
    }
    return ok("media.loudness", `${lufs.toFixed(1)} LUFS`);
  },
};

export const checkAudioStream: DeterministicCheck<{ probe: ProbeResult }> = {
  key: "media.audio-stream",
  run({ probe }): CheckOutcome {
    if (!probe.available) return skip("media.audio-stream", probe.reason ?? "probe unavailable");
    if (!probe.hasAudio) return fail("media.audio-stream", "no audio stream in the render", { fix: "check TTS/mixing pipeline" });
    return ok("media.audio-stream");
  },
};
