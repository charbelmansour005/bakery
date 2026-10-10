/**
 * `pending`, `paid` and `failed` are the life of a Whish payment. `placed` is a
 * cash-on-delivery order: confirmed, and paid for in person.
 */
export const ORDER_STATUSES = ['pending', 'paid', 'failed', 'placed'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_METHODS = ['whish', 'cash'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** An order the bakery should bake: paid online, or placed for cash. */
export function isConfirmed(status: OrderStatus): boolean {
  return status === 'paid' || status === 'placed';
}

/** Which Whish environment took the payment. Test orders never count as real ones. */
export const ORDER_MODES = ['test', 'live'] as const;
export type OrderMode = (typeof ORDER_MODES)[number];

/**
 * One ordered item, as it was priced at checkout. A copy, not a reference: the
 * menu can change the next day and the order must still say what was paid for.
 */
export type OrderLineDTO = {
  /** The cart line this came from (the topping's id, or the loaf's when plain). */
  key: string;
  baseName: string;
  basePriceCents: number;
  /** null for a plain loaf. */
  addOnName: string | null;
  addOnPriceCents: number;
  totalCents: number;
};

/** Plain JSON, no ObjectId and no Date — safe to hand to a Client Component. */
export type OrderDTO = {
  id: string;
  /** The number shown to the customer and the bakery, e.g. 1042. */
  number: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  mode: OrderMode;
  email: string;
  /** May be empty on a cash order placed without the checkout form. */
  phone: string;
  /** The Whish account that paid, when Whish reports it. */
  payerPhone: string;
  /** YYYY-MM-DD, or empty when it is still to be arranged. */
  pickupDate: string;
  note: string;
  lines: OrderLineDTO[];
  totalCents: number;
  /** ISO timestamps */
  createdAt: string;
  paidAt: string | null;
  fulfilledAt: string | null;
};

/** "Multigrain on Classic" / "Classic, plain" — the name a line goes by everywhere. */
export function orderLineTitle(line: OrderLineDTO): string {
  return line.addOnName ? `${line.addOnName} on ${line.baseName}` : `${line.baseName}, plain`;
}
