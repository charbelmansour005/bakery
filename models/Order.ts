import mongoose, { Schema, type Model, type InferSchemaType } from 'mongoose';
import { ORDER_MODES, ORDER_STATUSES } from '@/types/order';

/**
 * An order is one attempt to pay for a cart.
 *
 * It is created `pending` the moment the customer presses Pay, before Whish is
 * called, so there is always a record to settle against. It becomes `paid` in
 * exactly one place — settleOrder() in lib/orders.ts — and only after Whish
 * itself confirms the payment. A customer who abandons the payment page leaves
 * a `pending` order behind; trying again makes a new one, with a new number.
 *
 * Lines are a snapshot (names and prices), unlike the cart's product
 * references: an order records what was paid for, whatever the menu says later.
 */
const orderLineSchema = new Schema(
  {
    key: { type: String, required: true },
    baseName: { type: String, required: true },
    basePriceCents: { type: Number, required: true },
    addOnName: { type: String, default: null },
    addOnPriceCents: { type: Number, default: 0 },
    totalCents: { type: Number, required: true },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    /** Shown to people as #1042, and sent to Whish as `externalId`. */
    number: { type: Number, required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    /** YYYY-MM-DD. A calendar day, so a string — a Date would drag a timezone in. */
    pickupDate: { type: String, required: true },
    note: { type: String, default: '', trim: true },

    lines: { type: [orderLineSchema], required: true },
    totalCents: { type: Number, required: true },
    currency: { type: String, required: true, default: 'USD' },

    status: { type: String, enum: ORDER_STATUSES, required: true, default: 'pending' },
    /** Sandbox and live orders share a database; this keeps them apart. */
    mode: { type: String, enum: ORDER_MODES, required: true },

    /** Random, per order. Lets us ignore callback requests that are not for a real order. */
    callbackToken: { type: String, required: true },
    /** The Whish payment page for this order. */
    collectUrl: { type: String, default: '' },
    payerPhone: { type: String, default: '' },
    failureReason: { type: String, default: '' },

    paidAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    /** Set by the bakery when the order has been handed over. */
    fulfilledAt: { type: Date, default: null },
  },
  { timestamps: true },
);

orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index({ mode: 1, status: 1, pickupDate: 1 });

export type OrderDoc = InferSchemaType<typeof orderSchema>;

const Order =
  (mongoose.models.Order as Model<OrderDoc>) || mongoose.model<OrderDoc>('Order', orderSchema);

export default Order;
