// Content collections — announcements live in src/content/announcements/
// as plain markdown files. Add a .md file there and it shows up on the site.
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const announcements = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/announcements' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    course: z.string().optional(), // "us history" | "economics" | "law" | leave off for all
  }),
});

export const collections = { announcements };
