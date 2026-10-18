/**
 * SEO-pack contract (stage S7): titles, thumbnails, description, chapters,
 * disclosure — the exact fields the YouTube upload consumes.
 */
import { z } from "zod";

export const ThumbnailConceptSchema = z.strictObject({
  overlayText: z.string().min(2).max(60),
  concept: z.string().min(10).max(400),
  prompt: z.string().min(10).max(1200),
});

export const SeoPackSchema = z.strictObject({
  titles: z
    .array(z.strictObject({ text: z.string().min(8).max(100), style: z.string().min(2).max(40), reason: z.string().max(200) }))
    .min(3)
    .max(8),
  chosenTitle: z.string().min(8).max(100),
  thumbnails: z.array(ThumbnailConceptSchema).min(2).max(4),
  description: z.string().min(80).max(5000),
  tags: z.array(z.string().min(2).max(60)).max(30),
  chapters: z
    .array(z.strictObject({ at: z.string().regex(/^\d{1,2}:\d{2}(:\d{2})?$/), label: z.string().min(1).max(120) }))
    .max(40)
    .default([]),
  disclosure: z.strictObject({ required: z.boolean(), text: z.string().max(400) }),
  /** the triple the final QA judge compares: title = thumbnail = content */
  promise: z.strictObject({ title: z.string().min(8).max(100), thumbnail: z.string().min(2).max(60), core: z.string().min(10).max(300) }),
});

export type SeoPack = z.infer<typeof SeoPackSchema>;
export type ThumbnailConcept = z.infer<typeof ThumbnailConceptSchema>;
