/**
 * A cracker pack size: Discovery 50g, Sharing 100g. The pack carries the price;
 * the flavors inside it (cracker products) do not.
 *
 * Plain JSON, safe to hand to a Client Component.
 */
export type CrackerPackDTO = {
  id: string;
  name: string;
  grams: number;
  /** integer cents */
  price: number;
  /** How many different flavors one pack may hold. */
  maxFlavors: number;
  sortOrder: number;
};

/** One pack can be ordered this many times over. */
export const MAX_PACK_QUANTITY = 20;

/** "Sharing Pack 100g" */
export function packLabel(pack: { name: string; grams: number }): string {
  return `${pack.name} ${pack.grams}g`;
}
