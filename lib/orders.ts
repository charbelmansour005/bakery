import 'server-only';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { isValidObjectId, type Types } from 'mongoose';
import dbConnect from './db';
import { getCart, removeCartLines } from './cart';
import { sendOrderNotificationEmail, sendOrderReceiptEmail } from './mailer';
import { createPayment, getPaymentStatus, isWhishConfigured, whishMode } from './whish';
import Counter from '@/models/Counter';
import Order from '@/models/Order';
import type { CustomerSession } from './session';
import type { CheckoutInput } from './validation';
import type { OrderDTO, OrderLineDTO, OrderMode, OrderStatus } from '@/types/order';

/**
 * Orders and their payment.
 *
 * The rule everything here protects: **an order is paid only when Whish says
 * so, to us, server to server.** Whish's callback carries no signature, so it
 * is treated as a nudge and nothing more — it makes us ask Whish what happened.
 * The customer's browser returning from the payment page is the same nudge.
 * Neither can mark anything paid by itself, and the amount charged is always
 * the one stored here, never one read from a URL.
 */

/** First order number is 1001. */
const ORDER_NUMBER_BASE = 1000;
/** Each checkout calls Whish, so one customer cannot hammer it. */
const MAX_ORDERS_PER_WINDOW = 5;
const ORDER_WINDOW_MINUTES = 10;
/** How long an unpaid order is still worth asking Whish about. */
const SETTLE_WINDOW_HOURS = 24;
/** Unpaid orders re-checked each time the bakery opens its Orders page. */
const RECONCILE_LIMIT = 15;

/** A failure with a message that is safe to show the customer. */
export class OrderError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
  }
}

type LeanOrder = {
  _id: Types.ObjectId;
  number: number;
  customerId: Types.ObjectId;
  email: string;
  phone: string;
  pickupDate: string;
  note?: string;
  lines: OrderLineDTO[];
  totalCents: number;
  status: OrderStatus;
  mode: OrderMode;
  callbackToken: string;
  collectUrl?: string;
  payerPhone?: string;
  paidAt?: Date | null;
  fulfilledAt?: Date | null;
  createdAt: Date;
};

function toOrderDTO(doc: LeanOrder): OrderDTO {
  return {
    id: doc._id.toString(),
    number: doc.number,
    status: doc.status,
    mode: doc.mode,
    email: doc.email,
    phone: doc.phone,
    payerPhone: doc.payerPhone ?? '',
    pickupDate: doc.pickupDate,
    note: doc.note ?? '',
    lines: doc.lines.map((line) => ({
      key: line.key,
      baseName: line.baseName,
      basePriceCents: line.basePriceCents,
      addOnName: line.addOnName ?? null,
      addOnPriceCents: line.addOnPriceCents ?? 0,
      totalCents: line.totalCents,
    })),
    totalCents: doc.totalCents,
    createdAt: doc.createdAt.toISOString(),
    paidAt: doc.paidAt ? doc.paidAt.toISOString() : null,
    fulfilledAt: doc.fulfilledAt ? doc.fulfilledAt.toISOString() : null,
  };
}

async function nextOrderNumber(): Promise<number> {
  const counter = await Counter.findOneAndUpdate(
    { _id: 'order' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  ).lean<{ seq: number }>();
  return ORDER_NUMBER_BASE + counter!.seq;
}

/**
 * The public origin Whish should call and redirect to. SITE_URL when set —
 * production must use the canonical host, because the bare domain redirects and
 * a server-to-server callback should not have to follow that.
 */
function siteOrigin(requestOrigin: string): string {
  return (process.env.SITE_URL?.trim() || requestOrigin).replace(/\/+$/, '');
}

/* ---------- checkout ---------- */

/**
 * Turns the customer's cart into a pending order and opens a Whish payment for
 * it. Returns the URL of Whish's payment page.
 */
export async function createOrderFromCart(
  session: CustomerSession,
  details: CheckoutInput,
  requestOrigin: string,
): Promise<{ orderId: string; url: string }> {
  if (!isWhishConfigured()) {
    throw new OrderError('Online payment is not available right now.', 503);
  }
  await dbConnect();

  // The server's copy of the cart, at today's prices. Nothing about the items
  // or their prices is taken from the request.
  const cart = await getCart(session.sub);
  if (cart.lines.length === 0) {
    throw new OrderError('Your order is empty.');
  }
  if (cart.totalCents !== details.expectedTotalCents) {
    throw new OrderError('Your order changed since this page loaded. Check it and try again.', 409);
  }

  const since = new Date(Date.now() - ORDER_WINDOW_MINUTES * 60_000);
  const recent = await Order.countDocuments({ customerId: session.sub, createdAt: { $gte: since } });
  if (recent >= MAX_ORDERS_PER_WINDOW) {
    throw new OrderError('Too many payment attempts. Wait a few minutes and try again.', 429);
  }

  const number = await nextOrderNumber();
  const callbackToken = randomBytes(24).toString('hex');

  const order = await Order.create({
    number,
    customerId: session.sub,
    email: session.email,
    phone: details.phone,
    pickupDate: details.pickupDate,
    note: details.note,
    lines: cart.lines.map((line) => ({
      key: line.key,
      baseName: line.base.name,
      basePriceCents: line.base.price,
      addOnName: line.addOn?.name ?? null,
      addOnPriceCents: line.addOn?.price ?? 0,
      totalCents: line.totalCents,
    })),
    totalCents: cart.totalCents,
    currency: 'USD',
    status: 'pending',
    mode: whishMode(),
    callbackToken,
  });

  const id = order._id.toString();
  const origin = siteOrigin(requestOrigin);
  const callback = (result: 'success' | 'failure') =>
    `${origin}/api/whish/callback?order=${id}&t=${callbackToken}&result=${result}`;

  let collectUrl: string;
  try {
    collectUrl = await createPayment({
      amountCents: cart.totalCents,
      currency: 'USD',
      invoice: `Order #${number}`,
      externalId: number,
      successCallbackUrl: callback('success'),
      failureCallbackUrl: callback('failure'),
      // The browser lands on the same page either way; it shows whatever Whish
      // confirms, not what the URL claims.
      successRedirectUrl: `${origin}/orders/${id}`,
      failureRedirectUrl: `${origin}/orders/${id}`,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown error';
    console.error(`[whish] could not start payment for order #${number}: ${reason}`);
    await Order.updateOne(
      { _id: order._id },
      { $set: { status: 'failed', failedAt: new Date(), failureReason: reason.slice(0, 300) } },
    );
    throw new OrderError('We could not start the payment. Please try again in a moment.', 502);
  }

  await Order.updateOne({ _id: order._id }, { $set: { collectUrl } });
  return { orderId: id, url: collectUrl };
}

/* ---------- settlement ---------- */

/** Runs once per order, for whichever caller won the transition to paid. */
async function afterPaid(order: OrderDTO, customerId: string): Promise<void> {
  // Nothing here may undo the payment: each step fails on its own, and loudly.
  await removeCartLines(
    customerId,
    order.lines.map((line) => line.key),
  ).catch((err) => console.error(`[orders] could not clear the cart for #${order.number}:`, err));

  const [receipt, notice] = await Promise.allSettled([
    sendOrderReceiptEmail(order),
    sendOrderNotificationEmail(order),
  ]);
  if (receipt.status === 'rejected') {
    console.error(`[orders] receipt email failed for #${order.number}:`, receipt.reason);
  }
  if (notice.status === 'rejected') {
    console.error(`[orders] bakery notification failed for #${order.number}:`, notice.reason);
  }
}

/**
 * Asks Whish what happened to an order's payment and records the answer.
 *
 * Safe to call any number of times, from anywhere: the move to `paid` is a
 * single conditional update, so when the callback and the customer's return
 * land together, exactly one of them wins and runs the follow-up.
 *
 * A `failed` order is asked about again, not skipped: Whish lets a customer
 * retry on its payment page, so a failure can be followed by a success for the
 * same order.
 */
export async function settleOrder(orderId: string): Promise<OrderDTO | null> {
  if (!isValidObjectId(orderId)) return null;
  await dbConnect();

  const order = await Order.findById(orderId).lean<LeanOrder | null>();
  if (!order) return null;
  if (order.status === 'paid' || !isWhishConfigured()) return toOrderDTO(order);

  let result: Awaited<ReturnType<typeof getPaymentStatus>>;
  try {
    result = await getPaymentStatus(order.number);
  } catch (err) {
    // Whish is unreachable or answered oddly: change nothing, try again later.
    const reason = err instanceof Error ? err.message : 'unknown error';
    console.error(`[whish] status check failed for order #${order.number}: ${reason}`);
    return toOrderDTO(order);
  }

  if (result.status === 'success') {
    const paid = await Order.findOneAndUpdate(
      { _id: order._id, status: { $ne: 'paid' } },
      { $set: { status: 'paid', paidAt: new Date(), payerPhone: result.payerPhone } },
      { new: true },
    ).lean<LeanOrder | null>();

    if (paid) {
      const dto = toOrderDTO(paid);
      await afterPaid(dto, paid.customerId.toString());
      return dto;
    }
  } else if (result.status === 'failed') {
    await Order.updateOne(
      { _id: order._id, status: 'pending' },
      { $set: { status: 'failed', failedAt: new Date() } },
    );
  } else {
    return toOrderDTO(order);
  }

  // Either we lost the race to another caller, or we recorded a failure: read
  // back whatever is now true.
  const current = await Order.findById(orderId).lean<LeanOrder | null>();
  return current ? toOrderDTO(current) : null;
}

/**
 * Re-checks recent unpaid orders with Whish.
 *
 * The safety net for the one case nothing else covers: the customer paid, the
 * callback was lost, and they closed the tab before returning. Run when the
 * bakery opens its Orders page, so a paid order cannot sit unnoticed as
 * "pending". Only orders that actually reached Whish are asked about.
 */
export async function reconcileUnpaidOrders(): Promise<void> {
  if (!isWhishConfigured()) return;
  await dbConnect();

  const since = new Date(Date.now() - SETTLE_WINDOW_HOURS * 3_600_000);
  const unpaid = await Order.find({
    mode: whishMode(),
    status: { $in: ['pending', 'failed'] },
    collectUrl: { $ne: '' },
    createdAt: { $gte: since },
  })
    .sort({ createdAt: -1 })
    .limit(RECONCILE_LIMIT)
    .select('_id')
    .lean<{ _id: Types.ObjectId }[]>();

  // settleOrder never throws for a Whish failure; allSettled covers the rest.
  await Promise.allSettled(unpaid.map((order) => settleOrder(order._id.toString())));
}

/**
 * True when a callback request names a real order and carries its token. The
 * token is not what makes a payment trusted — Whish's own answer is — it only
 * stops strangers from making us query Whish for arbitrary orders.
 */
export async function isCallbackForOrder(orderId: string, token: string): Promise<boolean> {
  if (!isValidObjectId(orderId) || !token) return false;
  await dbConnect();

  const order = await Order.findById(orderId).select('callbackToken').lean<{ callbackToken: string } | null>();
  if (!order) return false;

  const expected = Buffer.from(order.callbackToken);
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/* ---------- reads ---------- */

/** An order, only if it belongs to this customer. */
export async function getOrderForCustomer(
  orderId: string,
  customerId: string,
): Promise<(OrderDTO & { payUrl: string; settleable: boolean }) | null> {
  if (!isValidObjectId(orderId) || !isValidObjectId(customerId)) return null;
  await dbConnect();

  const order = await Order.findOne({ _id: orderId, customerId }).lean<LeanOrder | null>();
  if (!order) return null;

  const ageMs = Date.now() - order.createdAt.getTime();
  return {
    ...toOrderDTO(order),
    // Only while unpaid: lets the customer go back and finish paying.
    payUrl: order.status === 'pending' ? (order.collectUrl ?? '') : '',
    settleable: order.status !== 'paid' && ageMs < SETTLE_WINDOW_HOURS * 3_600_000,
  };
}

/** The customer's paid orders, newest first. */
export async function listPaidOrdersForCustomer(customerId: string): Promise<OrderDTO[]> {
  if (!isValidObjectId(customerId)) return [];
  await dbConnect();

  const orders = await Order.find({ customerId, status: 'paid' })
    .sort({ createdAt: -1 })
    .limit(30)
    .lean<LeanOrder[]>();
  return orders.map(toOrderDTO);
}

/** The phone number the customer gave last time, to save them typing it again. */
export async function lastPhoneFor(customerId: string): Promise<string> {
  if (!isValidObjectId(customerId)) return '';
  await dbConnect();

  const order = await Order.findOne({ customerId })
    .sort({ createdAt: -1 })
    .select('phone')
    .lean<{ phone?: string } | null>();
  return order?.phone ?? '';
}

/**
 * Orders for the bakery. Only the current Whish environment's orders, so
 * sandbox payments never show up beside real ones. Open orders first, soonest
 * pickup at the top; handed-over ones after, most recent first.
 */
export async function listOrdersForAdmin(options: { includeUnpaid?: boolean } = {}): Promise<OrderDTO[]> {
  await dbConnect();

  const orders = await Order.find({
    mode: whishMode(),
    ...(options.includeUnpaid ? {} : { status: 'paid' }),
  })
    .sort({ createdAt: -1 })
    .limit(300)
    .lean<LeanOrder[]>();

  const rank = (order: OrderDTO) => (order.status !== 'paid' ? 2 : order.fulfilledAt ? 1 : 0);

  return orders.map(toOrderDTO).sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (rank(a) === 0) return a.pickupDate.localeCompare(b.pickupDate) || a.number - b.number;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

/** Marks a paid order handed over, or undoes that. */
export async function setFulfilled(orderId: string, fulfilled: boolean): Promise<OrderDTO | null> {
  if (!isValidObjectId(orderId)) return null;
  await dbConnect();

  const order = await Order.findOneAndUpdate(
    { _id: orderId, status: 'paid' },
    { $set: { fulfilledAt: fulfilled ? new Date() : null } },
    { new: true },
  ).lean<LeanOrder | null>();
  return order ? toOrderDTO(order) : null;
}
