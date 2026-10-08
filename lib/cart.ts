import 'server-only';
import { isValidObjectId, type Types } from 'mongoose';
import dbConnect from './db';
import Cart from '@/models/Cart';
import Product from '@/models/Product';
import type { Category, ProductDTO } from '@/types/product';
import { EMPTY_CART, lineKey, makeLine, totalOf, type CartDTO, type CartLineDTO } from '@/types/cart';
import type { CartLineInput } from './validation';

/**
 * Server-side cart, one per customer: a list of lines, each a loaf with an
 * optional topping folded through it.
 *
 * Stores product ids and resolves them on read, so a price edited in the CMS is
 * immediately the price the customer sees, and a product deleted from the menu
 * drops out of any cart holding it rather than lingering at a stale price.
 */

type LeanProduct = {
  _id: Types.ObjectId;
  name: string;
  category: Category;
  description: string;
  price: number;
  imageUrl: string;
  sortOrder: number;
};

type LeanLine = { base?: Types.ObjectId | null; addOn?: Types.ObjectId | null };

function toProductDTO(doc: LeanProduct): ProductDTO {
  return {
    id: doc._id.toString(),
    name: doc.name,
    category: doc.category,
    description: doc.description ?? '',
    price: doc.price,
    imageUrl: doc.imageUrl ?? '',
    sortOrder: doc.sortOrder ?? 0,
  };
}

function buildCart(lines: CartLineDTO[]): CartDTO {
  return { lines, totalCents: totalOf(lines) };
}

async function productsById(ids: string[]): Promise<Map<string, LeanProduct>> {
  const products = await Product.find({ _id: { $in: ids } }).lean<LeanProduct[]>();
  return new Map(products.map((p) => [p._id.toString(), p]));
}

export async function getCart(customerId: string): Promise<CartDTO> {
  if (!isValidObjectId(customerId)) return EMPTY_CART;
  await dbConnect();

  const cart = await Cart.findOne({ customerId }).lean<{ lines?: LeanLine[] } | null>();
  // A cart saved before per-line loaves ({ base, addOns }) has no `lines`, and
  // reads as empty rather than being guessed into the new shape.
  const stored = cart?.lines ?? [];
  if (stored.length === 0) return EMPTY_CART;

  const ids = stored.flatMap((line) =>
    [line.base, line.addOn].filter((id): id is Types.ObjectId => Boolean(id)).map(String),
  );
  const byId = await productsById(ids);

  const seen = new Set<string>();
  const lines: CartLineDTO[] = [];

  for (const raw of stored) {
    const base = raw.base ? byId.get(raw.base.toString()) : undefined;
    // The loaf is gone from the menu, or was re-categorised in the CMS.
    if (!base || base.category !== 'base') continue;

    let addOn: LeanProduct | null = null;
    if (raw.addOn) {
      addOn = byId.get(raw.addOn.toString()) ?? null;
      // A deleted topping drops the whole line — never serve a plain loaf the
      // customer did not order.
      if (!addOn || addOn.category === 'base') continue;
    }

    const line = makeLine(toProductDTO(base), addOn ? toProductDTO(addOn) : null);
    if (seen.has(line.key)) continue;
    seen.add(line.key);
    lines.push(line);
  }

  return buildCart(lines);
}

export class CartError extends Error {}

/**
 * Replaces the whole cart in one write. The client sends the state it wants
 * rather than a diff, so two rapid taps cannot interleave into a cart neither
 * of them asked for.
 *
 * The UI prevents invalid orders by construction, but the rules live here.
 */
export async function replaceCart(
  customerId: string,
  input: { lines: CartLineInput[] },
): Promise<CartDTO> {
  await dbConnect();

  const requested = [
    ...new Set(input.lines.flatMap((line) => [line.baseId, ...(line.addOnId ? [line.addOnId] : [])])),
  ];
  if (requested.some((id) => !isValidObjectId(id))) {
    throw new CartError('That item is not on the menu.');
  }

  const byId = await productsById(requested);
  if (requested.some((id) => !byId.has(id))) {
    throw new CartError('That item is no longer on the menu.');
  }

  const seen = new Set<string>();
  const lines: CartLineDTO[] = [];

  for (const { baseId, addOnId } of input.lines) {
    const base = byId.get(baseId)!;
    const addOn = addOnId ? byId.get(addOnId)! : null;

    if (base.category !== 'base') {
      throw new CartError(`${base.name} is a topping, not a loaf.`);
    }
    if (addOn && addOn.category === 'base') {
      throw new CartError(`${addOn.name} is a loaf, not a topping.`);
    }

    // Rejected rather than silently de-duplicated: with two loaves for the same
    // topping, deciding which one the customer meant would be a guess.
    const key = lineKey(baseId, addOnId);
    if (seen.has(key)) {
      throw new CartError(
        addOn
          ? `${addOn.name} is already in your order — each topping can be ordered once.`
          : `A plain ${base.name} is already in your order.`,
      );
    }
    seen.add(key);

    lines.push(makeLine(toProductDTO(base), addOn ? toProductDTO(addOn) : null));
  }

  await Cart.findOneAndUpdate(
    { customerId },
    {
      $set: { lines: input.lines.map(({ baseId, addOnId }) => ({ base: baseId, addOn: addOnId })) },
      // Drop the pre-per-line-loaf fields so old documents heal on their next
      // write. They are no longer in the schema, so `strict: false` is what
      // stops Mongoose stripping this $unset out of the update.
      $unset: { base: 1, addOns: 1 },
    },
    { upsert: true, new: true, runValidators: true, strict: false },
  );

  return buildCart(lines);
}

export async function clearCart(customerId: string): Promise<CartDTO> {
  await dbConnect();
  await Cart.findOneAndUpdate(
    { customerId },
    { $set: { lines: [] }, $unset: { base: 1, addOns: 1 } },
    { upsert: true, strict: false },
  );
  return EMPTY_CART;
}

/**
 * Removes the lines a paid order covered, and nothing else.
 *
 * Not simply clearCart(): between pressing Pay and Whish confirming, the
 * customer may have added something in another tab, and that item was not paid
 * for — it has to survive.
 */
export async function removeCartLines(customerId: string, keys: string[]): Promise<void> {
  if (!isValidObjectId(customerId) || keys.length === 0) return;
  await dbConnect();

  const cart = await Cart.findOne({ customerId }).lean<{ lines?: LeanLine[] } | null>();
  const stored = cart?.lines ?? [];
  if (stored.length === 0) return;

  const paid = new Set(keys);
  const remaining = stored.filter(
    (line) => !line.base || !paid.has(lineKey(line.base.toString(), line.addOn?.toString() ?? null)),
  );
  if (remaining.length === stored.length) return;

  await Cart.updateOne({ customerId }, { $set: { lines: remaining } });
}
