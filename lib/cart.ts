import 'server-only';
import { isValidObjectId, type Types } from 'mongoose';
import dbConnect from './db';
import { packsById, toPackDTO, type LeanPack } from './crackers';
import Cart from '@/models/Cart';
import Product from '@/models/Product';
import { isTopping, type Category, type ProductDTO } from '@/types/product';
import {
  EMPTY_CART,
  crackerKey,
  lineKey,
  makeCrackerLine,
  makeLine,
  totalOf,
  type CartDTO,
  type CartLineDTO,
  type CrackerLineDTO,
} from '@/types/cart';
import { MAX_PACK_QUANTITY } from '@/types/cracker';
import type { CartLineInput, CrackerLineInput } from './validation';

/**
 * Server-side cart, one per customer. Two kinds of item:
 *
 *  - lines: a loaf with an optional topping folded through it. Each topping
 *    and each plain loaf at most once.
 *  - crackers: a pack size, the flavors mixed into it, and a quantity.
 *
 * Stores ids and resolves them on read, so a price edited in the CMS is
 * immediately the price the customer sees, and anything deleted from the menu
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
type LeanCracker = { pack?: Types.ObjectId | null; flavors?: Types.ObjectId[]; quantity?: number };
type LeanCart = { lines?: LeanLine[]; crackers?: LeanCracker[] };

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

function buildCart(lines: CartLineDTO[], crackers: CrackerLineDTO[]): CartDTO {
  return { lines, crackers, totalCents: totalOf(lines, crackers) };
}

async function productsById(ids: string[]): Promise<Map<string, LeanProduct>> {
  const valid = ids.filter((id) => isValidObjectId(id));
  if (valid.length === 0) return new Map();
  const products = await Product.find({ _id: { $in: valid } }).lean<LeanProduct[]>();
  return new Map(products.map((p) => [p._id.toString(), p]));
}

/** Flavors in the order the customer will read them: as the menu lists them. */
function menuOrder(a: LeanProduct, b: LeanProduct): number {
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name);
}

export async function getCart(customerId: string): Promise<CartDTO> {
  if (!isValidObjectId(customerId)) return EMPTY_CART;
  await dbConnect();

  const cart = await Cart.findOne({ customerId }).lean<LeanCart | null>();
  // A cart saved before per-line loaves ({ base, addOns }) has no `lines`, and
  // reads as empty rather than being guessed into the new shape.
  const storedLines = cart?.lines ?? [];
  const storedCrackers = cart?.crackers ?? [];
  if (storedLines.length === 0 && storedCrackers.length === 0) return EMPTY_CART;

  const productIds = [
    ...storedLines.flatMap((line) => [line.base, line.addOn]),
    ...storedCrackers.flatMap((line) => line.flavors ?? []),
  ]
    .filter((id): id is Types.ObjectId => Boolean(id))
    .map(String);
  const [byId, packs] = await Promise.all([
    productsById(productIds),
    packsById(storedCrackers.map((line) => String(line.pack ?? ''))),
  ]);

  const seen = new Set<string>();
  const lines: CartLineDTO[] = [];
  for (const raw of storedLines) {
    const base = raw.base ? byId.get(raw.base.toString()) : undefined;
    // The loaf is gone from the menu, or was re-categorised in the CMS.
    if (!base || base.category !== 'base') continue;

    let addOn: LeanProduct | null = null;
    if (raw.addOn) {
      addOn = byId.get(raw.addOn.toString()) ?? null;
      // A deleted topping drops the whole line — never serve a plain loaf the
      // customer did not order.
      if (!addOn || !isTopping(addOn.category)) continue;
    }

    const line = makeLine(toProductDTO(base), addOn ? toProductDTO(addOn) : null);
    if (seen.has(line.key)) continue;
    seen.add(line.key);
    lines.push(line);
  }

  const crackers: CrackerLineDTO[] = [];
  for (const raw of storedCrackers) {
    const pack = raw.pack ? packs.get(raw.pack.toString()) : undefined;
    const flavors = (raw.flavors ?? []).map((id) => byId.get(id.toString()));
    // A pack or flavor taken off the menu drops the pack, rather than quietly
    // sending something different from what was asked for. So does a pack that
    // now holds more flavors than its size allows.
    if (!pack || flavors.length === 0 || flavors.some((f) => !f || f.category !== 'cracker')) continue;
    if (flavors.length > pack.maxFlavors) continue;

    const quantity = Math.min(MAX_PACK_QUANTITY, Math.max(1, Math.floor(raw.quantity ?? 1)));
    const line = makeCrackerLine(
      toPackDTO(pack),
      (flavors as LeanProduct[]).sort(menuOrder).map(toProductDTO),
      quantity,
    );
    if (seen.has(line.key)) continue;
    seen.add(line.key);
    crackers.push(line);
  }

  return buildCart(lines, crackers);
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
  input: { lines: CartLineInput[]; crackers?: CrackerLineInput[] },
): Promise<CartDTO> {
  await dbConnect();
  const crackerInput = input.crackers ?? [];

  const requested = [
    ...new Set([
      ...input.lines.flatMap((line) => [line.baseId, ...(line.addOnId ? [line.addOnId] : [])]),
      ...crackerInput.flatMap((line) => line.flavorIds),
    ]),
  ];
  if (requested.some((id) => !isValidObjectId(id))) {
    throw new CartError('That item is not on the menu.');
  }
  const packIds = [...new Set(crackerInput.map((line) => line.packId))];
  if (packIds.some((id) => !isValidObjectId(id))) {
    throw new CartError('That pack is not on the menu.');
  }

  const [byId, packs] = await Promise.all([productsById(requested), packsById(packIds)]);
  if (requested.some((id) => !byId.has(id))) {
    throw new CartError('That item is no longer on the menu.');
  }
  if (packIds.some((id) => !packs.has(id))) {
    throw new CartError('That pack is no longer on the menu.');
  }

  const seen = new Set<string>();
  const lines: CartLineDTO[] = [];

  for (const { baseId, addOnId } of input.lines) {
    const base = byId.get(baseId)!;
    const addOn = addOnId ? byId.get(addOnId)! : null;

    if (base.category !== 'base') {
      throw new CartError(`${base.name} is not a loaf.`);
    }
    if (addOn && !isTopping(addOn.category)) {
      throw new CartError(`${addOn.name} cannot be folded through a loaf.`);
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

  const crackers: CrackerLineDTO[] = [];
  for (const { packId, flavorIds, quantity } of crackerInput) {
    const pack = packs.get(packId)!;
    const distinct = [...new Set(flavorIds)];
    if (distinct.length !== flavorIds.length) {
      throw new CartError('Each flavor can go into a pack once.');
    }
    const flavors = distinct.map((id) => byId.get(id)!);
    const notCracker = flavors.find((flavor) => flavor.category !== 'cracker');
    if (notCracker) {
      throw new CartError(`${notCracker.name} is not a cracker flavor.`);
    }
    if (flavors.length > pack.maxFlavors) {
      throw new CartError(
        `The ${pack.name} holds up to ${pack.maxFlavors} flavor${pack.maxFlavors === 1 ? '' : 's'}.`,
      );
    }

    // The client merges identical packs into one line; two lines with the same
    // pack and flavors mean it got out of step, so refuse rather than guess.
    const key = crackerKey(packId, distinct);
    if (seen.has(key)) {
      throw new CartError('That pack is already in your order — change its quantity instead.');
    }
    seen.add(key);

    crackers.push(
      makeCrackerLine(toPackDTO(pack as LeanPack), flavors.sort(menuOrder).map(toProductDTO), quantity),
    );
  }

  await Cart.findOneAndUpdate(
    { customerId },
    {
      $set: {
        lines: input.lines.map(({ baseId, addOnId }) => ({ base: baseId, addOn: addOnId })),
        crackers: crackers.map((line) => ({
          pack: line.pack.id,
          flavors: line.flavors.map((flavor) => flavor.id),
          quantity: line.quantity,
        })),
      },
      // Drop the pre-per-line-loaf fields so old documents heal on their next
      // write. They are no longer in the schema, so `strict: false` is what
      // stops Mongoose stripping this $unset out of the update.
      $unset: { base: 1, addOns: 1 },
    },
    { upsert: true, new: true, runValidators: true, strict: false },
  );

  return buildCart(lines, crackers);
}

export async function clearCart(customerId: string): Promise<CartDTO> {
  await dbConnect();
  await Cart.findOneAndUpdate(
    { customerId },
    { $set: { lines: [], crackers: [] }, $unset: { base: 1, addOns: 1 } },
    { upsert: true, strict: false },
  );
  return EMPTY_CART;
}

/**
 * Removes the lines a placed or paid order covered, and nothing else.
 *
 * Not simply clearCart(): between pressing Pay and Whish confirming, the
 * customer may have added something in another tab, and that item was not paid
 * for — it has to survive. A pack whose quantity was raised in the meantime is
 * removed whole: the order recorded the quantity it was placed with.
 */
export async function removeCartLines(customerId: string, keys: string[]): Promise<void> {
  if (!isValidObjectId(customerId) || keys.length === 0) return;
  await dbConnect();

  const cart = await Cart.findOne({ customerId }).lean<LeanCart | null>();
  const storedLines = cart?.lines ?? [];
  const storedCrackers = cart?.crackers ?? [];
  if (storedLines.length === 0 && storedCrackers.length === 0) return;

  const paid = new Set(keys);
  const lines = storedLines.filter(
    (line) => !line.base || !paid.has(lineKey(line.base.toString(), line.addOn?.toString() ?? null)),
  );
  const crackers = storedCrackers.filter(
    (line) =>
      !line.pack ||
      !paid.has(
        crackerKey(
          line.pack.toString(),
          (line.flavors ?? []).map((id) => id.toString()),
        ),
      ),
  );
  if (lines.length === storedLines.length && crackers.length === storedCrackers.length) return;

  await Cart.updateOne({ customerId }, { $set: { lines, crackers } });
}
