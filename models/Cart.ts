import mongoose, { Schema, type Model, type InferSchemaType } from 'mongoose';

/**
 * One cart per customer, stored server-side.
 *
 * A cart is a list of lines, and every line carries its own loaf: either a
 * plain loaf, or a topping folded through the loaf the customer picked for it.
 * "Multigrain on Classic" and "Chocolate on Whole Wheat" are two separate
 * lines, each priced as topping + loaf.
 *
 * Product references rather than copies: a cart should reflect the menu as it
 * is now, so a price edited in the CMS is the price the customer sees. Lines
 * whose products have since been deleted are dropped when the cart is read.
 *
 * Uniqueness (each topping once, each plain loaf once) is enforced in
 * lib/cart.ts rather than by an index — it is a rule about a line's key, which
 * a Mongo unique index cannot express inside an embedded array.
 */
const cartLineSchema = new Schema(
  {
    base: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    /** null for a plain loaf. */
    addOn: { type: Schema.Types.ObjectId, ref: 'Product', default: null },
  },
  { _id: false },
);

/**
 * A cracker pack: a size, the flavors mixed into it, and how many. Kept apart
 * from `lines` because it follows different rules — packs have quantities,
 * loaves do not.
 */
const crackerLineSchema = new Schema(
  {
    pack: { type: Schema.Types.ObjectId, ref: 'CrackerPack', required: true },
    flavors: { type: [{ type: Schema.Types.ObjectId, ref: 'Product' }], required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const cartSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, unique: true },
    lines: { type: [cartLineSchema], default: [] },
    crackers: { type: [crackerLineSchema], default: [] },
  },
  { timestamps: true },
);

export type CartDoc = InferSchemaType<typeof cartSchema>;

const Cart =
  (mongoose.models.Cart as Model<CartDoc>) || mongoose.model<CartDoc>('Cart', cartSchema);

export default Cart;
