export const CATEGORIES = ['base', 'savory', 'sweet', 'cracker'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  base: 'Base Loaves',
  savory: 'Savory',
  sweet: 'Sweet',
  cracker: 'Crackers',
};

/** A topping folded through a loaf. Crackers are not toppings. */
export function isTopping(category: Category): boolean {
  return category === 'savory' || category === 'sweet';
}

/**
 * The only shape of a product that crosses the server/client boundary.
 * Plain JSON — no ObjectId, no Date — so it is safe to hand to a Client Component.
 */
export type ProductDTO = {
  id: string;
  name: string;
  category: Category;
  description: string;
  /** integer cents */
  price: number;
  imageUrl: string;
  sortOrder: number;
};
