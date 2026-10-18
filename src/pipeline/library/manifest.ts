/**
 * Licensed library manifest (music + stock footage).
 *
 * Deliberately EMPTY: the constitution forbids shipping unlicensed assets and
 * fake data. The pickers return null until real licensed files are added;
 * stages then fall back to generated media or "no music" — never to piracy.
 *
 * Add entries like:
 *   { id: "track-001", title: "Calm Intro", mood: ["calm","intro"],
 *     license: "CC0", licenseUrl: "https://...", filePath: "assets/music/001.mp3" }
 */

export interface LicensedTrack {
  id: string;
  title: string;
  mood: string[];
  license: string;
  licenseUrl?: string;
  filePath?: string;
}

export interface LicensedClip {
  id: string;
  tags: string[];
  license: string;
  licenseUrl?: string;
  filePath?: string;
}

export const MUSIC_LIBRARY: LicensedTrack[] = [];
export const FOOTAGE_LIBRARY: LicensedClip[] = [];

export function pickTrack(mood?: string): LicensedTrack | null {
  if (!MUSIC_LIBRARY.length) return null;
  if (mood) {
    const hit = MUSIC_LIBRARY.find((t) => t.mood.some((m) => m.toLowerCase() === mood.toLowerCase()));
    if (hit) return hit;
  }
  return MUSIC_LIBRARY[0];
}

export function pickClip(tag?: string): LicensedClip | null {
  if (!FOOTAGE_LIBRARY.length) return null;
  if (tag) {
    const hit = FOOTAGE_LIBRARY.find((c) => c.tags.some((t) => t.toLowerCase() === tag.toLowerCase()));
    if (hit) return hit;
  }
  return FOOTAGE_LIBRARY[0];
}
