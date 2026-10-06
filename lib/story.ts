import 'server-only';
import { cache } from 'react';
import dbConnect from './db';
import Story, { STORY_SINGLETON } from '@/models/Story';
import { HERO_IMAGE, HERO_TEXT, STORY_IMAGES, STORY_TEXT } from './config';
import type { StoryDTO } from '@/types/story';

/**
 * The landing page's editable content — the hero photograph and the Our Story
 * section — managed from the CMS.
 *
 * STORY_IMAGES in lib/config.ts is the floor, not the source of truth: it is
 * what renders before anyone has saved anything (and if the document is
 * missing), so a fresh clone still shows a finished-looking page.
 */

type LeanStory = {
  heading?: string;
  body?: string;
  primary?: { url?: string; alt?: string };
  secondary?: { url?: string; alt?: string };
  hero?: { url?: string; alt?: string };
  heroEyebrow?: string;
  heroHeadline?: string;
  heroTagline?: string;
};

function toStoryDTO(doc: LeanStory | null): StoryDTO {
  return {
    // The document predates these fields, so absent means "use the default" —
    // no migration needed.
    heading: doc?.heading || STORY_TEXT.heading,
    body: doc?.body || STORY_TEXT.body,
    primary: {
      url: doc?.primary?.url || STORY_IMAGES.primary.src,
      alt: doc?.primary?.alt || STORY_IMAGES.primary.alt,
    },
    secondary: {
      url: doc?.secondary?.url || STORY_IMAGES.secondary.src,
      alt: doc?.secondary?.alt || STORY_IMAGES.secondary.alt,
    },
    hero: {
      url: doc?.hero?.url || HERO_IMAGE.src,
      alt: doc?.hero?.alt || HERO_IMAGE.alt,
    },
    heroEyebrow: doc?.heroEyebrow || HERO_TEXT.eyebrow,
    heroHeadline: doc?.heroHeadline || HERO_TEXT.headline,
    heroTagline: doc?.heroTagline || HERO_TEXT.tagline,
  };
}

/** Uncached read. Mutations use this so they never merge against a memoised value. */
async function readStory(): Promise<StoryDTO> {
  await dbConnect();
  const doc = await Story.findOne({ singleton: STORY_SINGLETON }).lean<LeanStory | null>();
  return toStoryDTO(doc);
}

/** Wrapped in React `cache` so one render hits Mongo once. */
export const getStory = cache(readStory);

export async function updateStory(input: Partial<StoryDTO>): Promise<StoryDTO> {
  await dbConnect();

  // Always write BOTH halves. With `upsert: true`, Mongoose runs update
  // validators as though inserting, so a $set carrying only `secondary` fails
  // on primary.url/primary.alt being required. Merging against the current
  // value keeps the document complete and the validators meaningful.
  const current = await readStory();
  const next: StoryDTO = {
    heading: input.heading ?? current.heading,
    body: input.body ?? current.body,
    primary: input.primary ?? current.primary,
    secondary: input.secondary ?? current.secondary,
    hero: input.hero ?? current.hero,
    heroEyebrow: input.heroEyebrow ?? current.heroEyebrow,
    heroHeadline: input.heroHeadline ?? current.heroHeadline,
    heroTagline: input.heroTagline ?? current.heroTagline,
  };

  const doc = await Story.findOneAndUpdate(
    { singleton: STORY_SINGLETON },
    { $set: next },
    { new: true, upsert: true, runValidators: true },
  ).lean<LeanStory | null>();

  return toStoryDTO(doc);
}
