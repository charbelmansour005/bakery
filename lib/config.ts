/** Bakery-wide constants. Shared by server and client components. */

/**
 * The bakery's WhatsApp number, in E.164: digits only, no leading "+". Orders
 * and flavour ideas are both sent here.
 *
 * Written locally as 71 862 139. The 71 prefix carries no trunk zero, so the
 * international form is simply +961 71 862 139. (Numbers written locally with a
 * leading 0, like 03 xxx xxx, must drop it — a wa.me link that keeps the 0
 * resolves to nothing.)
 *
 * Override per-environment with NEXT_PUBLIC_WHATSAPP_NUMBER.
 */
export const WHATSAPP_NUMBER =
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '96171862139';

export const BAKERY = {
  name: 'La Belle Fournée',
  tagline: 'Artisan Bakery',
  phone: '+961 71 862 139',
  address: 'Main Road, Amioun',
  footerTagline: 'Pre-Order • Freshly Baked • Limited Batches',
  legal: 'La Belle Fournée',
  /** Instagram handle, without the @. The bakery has no other social accounts. */
  instagram: 'labellefournee',
} as const;

export const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Menu', href: '/menu' },
  { label: 'Our Story', href: '/#story' },
  { label: 'Have an Idea?', href: '/#have-an-idea' },
] as const;

/**
 * Fallback text for the "Our Story" section — what renders until the bakery
 * saves its own at /admin/story. `body` is paragraphs separated by a blank line.
 */
export const STORY_TEXT = {
  heading: 'Flour, water, salt, time.',
  body: [
    'We keep one starter, fed every morning since the day we opened. Every loaf is mixed by hand, rested overnight, and baked at dawn in small batches.',
    'Each pre-order is shaped for the person who asked for it, then wrapped by hand before it leaves the kitchen. That is why we bake to order, and why there is never quite enough.',
  ].join('\n\n'),
} as const;

/** Fallback hero photograph, on the same terms as STORY_IMAGES below. */
export const HERO_IMAGE = {
  src: '/images/hero-chocolate-sourdough.jpg',
  alt: 'A chocolate sourdough loaf torn open on a linen cloth in a warm bakery kitchen',
} as const;

/**
 * Fallback photographs for the "Our Story" section.
 *
 * These are NOT the source of truth — the live images are managed in the CMS at
 * /admin/story and stored in MongoDB (see lib/story.ts). This is what renders
 * before anything has been saved, and what a fresh clone of the repo shows, so
 * the landing page never looks half-built.
 *
 * `primary` is cropped to 4:5 and `secondary` to 3:4 by the section.
 */
export const STORY_IMAGES = {
  primary: {
    src: '/images/story-shaping.jpg',
    alt: 'Shaping a sourdough loaf by hand on a flour-dusted bench',
  },
  secondary: {
    src: '/images/story-wrapping.jpg',
    alt: 'A finished loaf wrapped in paper and twine, ready for collection',
  },
} as const;
