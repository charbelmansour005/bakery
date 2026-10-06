import { z } from 'zod';
import { CATEGORIES, type Category } from '@/types/product';

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
