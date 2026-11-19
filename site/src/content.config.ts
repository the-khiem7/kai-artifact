import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

// Mirrors .claude/skills/knowledge-distill/references/note-format.md; the build also runs check_notes.py first.
const documents = defineCollection({
  loader: glob({ pattern: "*.md", base: "../documents" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    lang: z.enum(["vi", "en"]),
    date: z.coerce.date(),
    topics: z.array(z.string()),
    status: z.enum(["verified", "partially-verified", "unverified"]),
  }),
});

export const collections = { documents };
