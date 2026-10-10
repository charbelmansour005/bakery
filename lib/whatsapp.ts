import { BAKERY, WHATSAPP_NUMBER } from './config';
import { formatCents } from './money';
import { formatPickupDate } from './pickup';
import type { OrderDTO, OrderLineDTO } from '@/types/order';

/**
 * What the site sends to the bakery over WhatsApp: flavour ideas, and a copy
 * of every saved order — cash on delivery, or already paid online. Not marked
 * `server-only` — the order bar and the idea form are client components.
 */

export function whatsappUrl(text: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
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

/**
 * One line per item, in the bakery's own notation:
 *
 *   - Multigrain $2.00 + Classic $4 = $6.00
 *   - Classic $4 (plain)
 */
export function describeOrderLine(line: OrderLineDTO): string {
  const loaf = `${line.baseName} ${formatCents(line.basePriceCents, { compact: true })}`;
  if (!line.addOnName) return `- ${loaf} (plain)`;
  return `- ${line.addOnName} ${formatCents(line.addOnPriceCents)} + ${loaf} = ${formatCents(line.totalCents)}`;
}

/**
 * A saved order, written out for the bakery's chat: one already paid online,
 * or a cash-on-delivery order the customer has just placed.
 */
export function buildSavedOrderMessage(order: OrderDTO): string {
  const cash = order.paymentMethod === 'cash';
  return [
    cash
      ? `Hello ${BAKERY.name}! I placed order #${order.number}, cash on delivery.`
      : `Hello ${BAKERY.name}! I just paid for order #${order.number} online.`,
    '',
    ...order.lines.map(describeOrderLine),
    '',
    `${cash ? 'Total' : 'Total paid'}: ${formatCents(order.totalCents)}`,
    ...extraLines({ pickupDate: order.pickupDate, note: order.note }),
  ].join('\n');
}
