import { BAKERY, WHATSAPP_NUMBER } from './config';
import { formatCents } from './money';
import { formatPickupDate } from './pickup';
import type { CartLineDTO } from '@/types/cart';
import type { OrderDTO, OrderLineDTO } from '@/types/order';

/**
 * What the site sends to the bakery over WhatsApp: pay-on-pickup orders,
 * flavour ideas, and a copy of an order already paid online. Not marked
 * `server-only` — the order bar and the idea form are client components.
 */

export function whatsappUrl(text: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

/**
 * One line per item, in the bakery's own notation:
 *
 *   - Multigrain $2.00 + Classic $4 = $6.00
 *   - Classic $4 (plain)
 */
function describeLine(line: CartLineDTO): string {
  const loaf = `${line.base.name} ${formatCents(line.base.price, { compact: true })}`;
  if (!line.addOn) return `- ${loaf} (plain)`;
  return `- ${line.addOn.name} ${formatCents(line.addOn.price)} + ${loaf} = ${formatCents(line.totalCents)}`;
}

export function buildIdeaMessage(idea: string): string {
  return [`Hello ${BAKERY.name}! I have a flavor idea for a sourdough:`, '', idea.trim()].join('\n');
}

/** The pickup day and note, when the customer filled them in. */
function extraLines(extras: { pickupDate?: string; note?: string }): string[] {
  return [
    extras.pickupDate ? `Pickup: ${formatPickupDate(extras.pickupDate)}` : '',
    extras.note?.trim() ? `Note: ${extras.note.trim()}` : '',
  ].filter(Boolean);
}

export function buildOrderMessage(
  lines: CartLineDTO[],
  totalCents: number,
  extras: { pickupDate?: string; note?: string } = {},
): string {
  return [
    `Hello ${BAKERY.name}! I would like to pre-order:`,
    '',
    ...lines.map(describeLine),
    '',
    `Total: ${formatCents(totalCents)}`,
    ...extraLines(extras),
  ].join('\n');
}

/** The same notation as describeLine, from an order's price snapshot. */
export function describeOrderLine(line: OrderLineDTO): string {
  const loaf = `${line.baseName} ${formatCents(line.basePriceCents, { compact: true })}`;
  if (!line.addOnName) return `- ${loaf} (plain)`;
  return `- ${line.addOnName} ${formatCents(line.addOnPriceCents)} + ${loaf} = ${formatCents(line.totalCents)}`;
}

/** Sent by the customer after paying online, so the order also lands in the bakery's chat. */
export function buildPaidOrderMessage(order: OrderDTO): string {
  return [
    `Hello ${BAKERY.name}! I just paid for order #${order.number} online.`,
    '',
    ...order.lines.map(describeOrderLine),
    '',
    `Total paid: ${formatCents(order.totalCents)}`,
    ...extraLines({ pickupDate: order.pickupDate, note: order.note }),
  ].join('\n');
}
