export const ORDER_STATUSES = ['pending', 'paid', 'failed'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

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
  mode: OrderMode;
  email: string;
  phone: string;
  /** The Whish account that paid, when Whish reports it. */
  payerPhone: string;
  /** YYYY-MM-DD */
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
