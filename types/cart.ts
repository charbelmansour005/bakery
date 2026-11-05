import type { CrackerPackDTO } from './cracker';
import type { ProductDTO } from './product';

/**
 * One item in an order: a loaf, optionally with a topping folded through it.
 *
 * `key` identifies the line — the topping's id, or the loaf's id for a plain
 * loaf. Product ids are unique across the whole menu, so a single "keys are
 * unique" rule enforces both "each topping once" and "each plain loaf once".
 */
export type CartLineDTO = {
  key: string;
  base: ProductDTO;
  /** null for a plain loaf. */
  addOn: ProductDTO | null;
  /** loaf + topping, integer cents */
  totalCents: number;
};

/**
 * A cracker pack: a size, the flavors mixed into it, and how many of it.
 *
 * Unlike loaves, packs have quantities. Two packs with the same size and the
 * same flavors are the same line — `key` is built from both, with the flavors
 * sorted, so the order they were tapped in does not matter.
 */
export type CrackerLineDTO = {
  key: string;
  pack: CrackerPackDTO;
  flavors: ProductDTO[];
  quantity: number;
  /** price of one pack, integer cents */
  unitCents: number;
  /** unitCents × quantity */
  totalCents: number;
};

/** The cart as it crosses to the client: resolved products, never raw ids. */
export type CartDTO = {
  lines: CartLineDTO[];
  crackers: CrackerLineDTO[];
  totalCents: number;
};

export const EMPTY_CART: CartDTO = { lines: [], crackers: [], totalCents: 0 };

/** The key a line is identified by. Shared by server and client so they agree. */
export function lineKey(baseId: string, addOnId: string | null): string {
  return addOnId ?? baseId;
}

/** Builds a line. Shared so the optimistic client and the server price it identically. */
export function makeLine(base: ProductDTO, addOn: ProductDTO | null): CartLineDTO {
  return {
    key: lineKey(base.id, addOn?.id ?? null),
    base,
    addOn,
    totalCents: base.price + (addOn?.price ?? 0),
  };
}

/** "pack:flavorA+flavorB" — the same pack and flavors always give the same key. */
export function crackerKey(packId: string, flavorIds: string[]): string {
  return `${packId}:${[...flavorIds].sort().join('+')}`;
}

export function makeCrackerLine(pack: CrackerPackDTO, flavors: ProductDTO[], quantity: number): CrackerLineDTO {
  return {
    key: crackerKey(
      pack.id,
      flavors.map((flavor) => flavor.id),
    ),
    pack,
    flavors,
    quantity,
    unitCents: pack.price,
    totalCents: pack.price * quantity,
  };
}

export function totalOf(lines: CartLineDTO[], crackers: CrackerLineDTO[] = []): number {
  return (
    lines.reduce((sum, line) => sum + line.totalCents, 0) +
    crackers.reduce((sum, line) => sum + line.totalCents, 0)
  );
}
