import { z } from 'zod';
import { CATEGORIES, type Category } from '@/types/product';
import { isValidPickupDate } from './pickup';

const categoryEnum = z.enum(CATEGORIES as unknown as [Category, ...Category[]]);

/** Prices arrive as integer CENTS. The admin form converts dollars -> cents before sending. */
export const productCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  category: categoryEnum,
  description: z.string().trim().max(300).default(''),
  price: z.number().int('Price must be whole cents').min(0).max(1_000_000),
  imageUrl: z.string().trim().max(500).default(''),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});

export const productUpdateSchema = productCreateSchema.partial();

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required').max(120),
  password: z.string().min(1, 'Password is required').max(200),
});

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

const storyImageSchema = z.object({
  url: z.string().trim().max(500).default(''),
  alt: z.string().trim().max(200).default(''),
});

/** Every field is optional so the form can save part of the story at a time. */
export const storyUpdateSchema = z
  .object({
    heading: z.string().trim().min(1, 'The story needs a heading.').max(120),
    body: z.string().trim().min(1, 'The story needs some text.').max(2000),
    primary: storyImageSchema,
    secondary: storyImageSchema,
    hero: storyImageSchema,
    heroEyebrow: z.string().trim().min(1, 'The hero needs its small top line.').max(60),
    heroHeadline: z.string().trim().min(1, 'The hero needs a headline.').max(160),
    heroTagline: z.string().trim().min(1, 'The hero needs a tagline.').max(240),
  })
  .partial()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Nothing to update.',
  });

export type StoryUpdateInput = z.infer<typeof storyUpdateSchema>;

export const requestCodeSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(200),
});

export const verifyCodeSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(200),
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code from your email.'),
});

const cartLineInputSchema = z.object({
  baseId: z.string().trim().min(1, 'Every item needs a loaf.').max(64),
  // An empty string means "plain loaf". Without collapsing it to null it
  // reaches Mongoose as '' and blows up the ObjectId cast with a 500 instead of
  // simply meaning "no topping".
  addOnId: z
    .string()
    .trim()
    .max(64)
    .nullable()
    .default(null)
    .transform((value) => value || null),
});

export const cartReplaceSchema = z.object({
  lines: z.array(cartLineInputSchema).max(30).default([]),
});

export type CartLineInput = z.infer<typeof cartLineInputSchema>;

/**
 * What the customer fills in before paying. Deliberately no prices and no
 * items: the order is built from the server's copy of the cart. The one number
 * here, `expectedTotalCents`, is only compared against that copy, so a customer
 * is never charged a total different from the one they were looking at.
 */
export const checkoutSchema = z.object({
  phone: z
    .string()
    .trim()
    .max(40)
    // Keep digits and a leading +; drop the spaces, dashes and brackets people type.
    .transform((value) => value.replace(/(?!^\+)[^\d]/g, ''))
    .refine((value) => /^\+?\d{7,15}$/.test(value), 'Enter a phone number we can reach you on.'),
  pickupDate: z
    .string()
    .trim()
    .refine((value) => isValidPickupDate(value), 'Choose a pickup day from the ones offered.'),
  note: z.string().trim().max(300, 'Keep the note under 300 characters.').default(''),
  expectedTotalCents: z.number().int().min(0).max(100_000_000),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const orderFulfilSchema = z.object({ fulfilled: z.boolean() });
