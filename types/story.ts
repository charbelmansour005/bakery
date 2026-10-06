/** One photograph in the Our Story section. */
export type StoryImageDTO = {
  /** Empty string means "nothing uploaded yet" — the section draws a placeholder. */
  url: string;
  alt: string;
};

/**
 * Plain JSON, no ObjectId and no Date, so it is safe to hand to a Client
 * Component. Mirrors ProductDTO's role for products.
 */
export type StoryDTO = {
  heading: string;
  /** Paragraphs separated by a blank line. */
  body: string;
  primary: StoryImageDTO;
  secondary: StoryImageDTO;
  /** The full-bleed photograph behind the landing page's hero. */
  hero: StoryImageDTO;
  /** The small line above the hero headline. */
  heroEyebrow: string;
  /** One line per row; the last line is set in gold. */
  heroHeadline: string;
  /** The italic sentence under the hero headline. */
  heroTagline: string;
};
