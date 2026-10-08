import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';
import { BAKERY } from './config';
import { formatCents } from './money';
import { formatPickupDate } from './pickup';
import { orderLineTitle, type OrderDTO } from '@/types/order';

/**
 * Nodemailer over SMTP.
 *
 * With no SMTP_HOST configured, development logs the message to the server
 * console instead of sending, so sign-in and order emails are testable without
 * credentials. Production refuses to fall back — silently not sending a login
 * code would lock every customer out with no visible error.
 */

let cached: Transporter | null = null;

function isConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

function transporter(): Transporter {
  if (cached) return cached;

  const port = Number(process.env.SMTP_PORT ?? 587);
  cached = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // 465 is implicit TLS; 587 upgrades with STARTTLS.
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
  return cached;
}

export async function sendMail(options: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  if (!isConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASSWORD.');
    }
    console.info(
      `\n--- email (not sent: SMTP not configured) ---\nto: ${options.to}\nsubject: ${options.subject}\n\n${options.text}\n--------------------------------------------\n`,
    );
    return;
  }

  await transporter().sendMail({
    // Default to the account we authenticate as: most SMTP providers reject or
    // rewrite a From address that does not match the authenticated sender.
    from: process.env.SMTP_FROM ?? `${BAKERY.name} <${process.env.SMTP_USER}>`,
    ...options,
  });
}

/** The sign-in code email. Plain text alongside HTML, for clients that refuse it. */
export async function sendOtpEmail(to: string, code: string, minutes: number): Promise<void> {
  const text = [
    `Your ${BAKERY.name} sign-in code is ${code}.`,
    ``,
    `It expires in ${minutes} minutes and can be used once.`,
    `If you did not ask to sign in, you can ignore this email.`,
  ].join('\n');

  const html = `
<div style="font-family:Georgia,'Times New Roman',serif;background:#f6f1e7;padding:40px 24px;color:#4a3126">
  <div style="max-width:440px;margin:0 auto;background:#fdfbf7;border:1px solid #ece3d2;border-radius:12px;padding:36px 32px;text-align:center">
    <p style="margin:0;font-size:22px;letter-spacing:-0.01em">${BAKERY.name}</p>
    <p style="margin:4px 0 28px;font-style:italic;font-size:13px;color:#8a6a58">${BAKERY.tagline}</p>
    <p style="margin:0 0 12px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8a6a58">Your sign-in code</p>
    <p style="margin:0;font-size:38px;letter-spacing:0.22em;color:#4a3126"><strong>${code}</strong></p>
    <p style="margin:24px 0 0;font-size:13px;color:#8a6a58">
      Expires in ${minutes} minutes, and can be used once.
    </p>
    <p style="margin:20px 0 0;font-size:12px;color:#8a6a58">
      If you did not ask to sign in, you can ignore this email.
    </p>
  </div>
</div>`.trim();

  await sendMail({ to, subject: `${code} is your ${BAKERY.name} sign-in code`, text, html });
}

/* ---------- order emails ---------- */

/** Product names, notes and phone numbers are typed in by people — never trust them in HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function orderShell(inner: string): string {
  return `
<div style="font-family:Georgia,'Times New Roman',serif;background:#f6f1e7;padding:40px 24px;color:#4a3126">
  <div style="max-width:480px;margin:0 auto;background:#fdfbf7;border:1px solid #ece3d2;border-radius:12px;padding:36px 32px">
    <p style="margin:0;font-size:22px;letter-spacing:-0.01em;text-align:center">${BAKERY.name}</p>
    <p style="margin:4px 0 28px;font-style:italic;font-size:13px;color:#8a6a58;text-align:center">${BAKERY.tagline}</p>
    ${inner}
  </div>
</div>`.trim();
}

function orderRowsHtml(order: OrderDTO): string {
  const rows = order.lines
    .map(
      (line) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #ece3d2;font-size:15px">${escapeHtml(orderLineTitle(line))}</td>
        <td style="padding:8px 0;border-bottom:1px solid #ece3d2;font-size:15px;text-align:right;white-space:nowrap">${formatCents(line.totalCents)}</td>
      </tr>`,
    )
    .join('');

  return `
    <table role="presentation" style="width:100%;border-collapse:collapse">
      ${rows}
      <tr>
        <td style="padding:12px 0 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8a6a58">Total paid</td>
        <td style="padding:12px 0 0;font-size:20px;text-align:right">${formatCents(order.totalCents)}</td>
      </tr>
    </table>`;
}

function orderLinesText(order: OrderDTO): string[] {
  return order.lines.map((line) => `- ${orderLineTitle(line)}  ${formatCents(line.totalCents)}`);
}

/** Marks sandbox payments so nobody bakes for one. */
function testPrefix(order: OrderDTO): string {
  return order.mode === 'test' ? '[TEST] ' : '';
}

/** The customer's receipt, sent once when Whish confirms the payment. */
export async function sendOrderReceiptEmail(order: OrderDTO): Promise<void> {
  const pickup = formatPickupDate(order.pickupDate);

  const text = [
    `Thank you — your order #${order.number} is paid.`,
    ``,
    ...orderLinesText(order),
    ``,
    `Total paid: ${formatCents(order.totalCents)}`,
    `Pickup: ${pickup}, ${BAKERY.address}`,
    ...(order.note ? [`Your note: ${order.note}`] : []),
    ``,
    `Questions? Call or WhatsApp ${BAKERY.phone}.`,
  ].join('\n');

  const html = orderShell(`
    <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8a6a58;text-align:center">Order #${order.number}</p>
    <p style="margin:0 0 24px;font-size:24px;text-align:center">Thank you — it's paid.</p>
    ${orderRowsHtml(order)}
    <p style="margin:24px 0 0;font-size:15px"><strong>Pickup:</strong> ${escapeHtml(pickup)}<br>${escapeHtml(BAKERY.address)}</p>
    ${order.note ? `<p style="margin:12px 0 0;font-size:14px;color:#8a6a58"><strong>Your note:</strong> ${escapeHtml(order.note)}</p>` : ''}
    <p style="margin:24px 0 0;font-size:13px;color:#8a6a58">Questions? Call or WhatsApp ${escapeHtml(BAKERY.phone)}.</p>`);

  await sendMail({
    to: order.email,
    subject: `${testPrefix(order)}Your ${BAKERY.name} order #${order.number} is paid`,
    text,
    html,
  });
}

/** Where paid-order notifications go. Defaults to the account the site sends from. */
function bakeryInbox(): string | null {
  return process.env.ORDER_NOTIFY_EMAIL?.trim() || process.env.SMTP_USER?.trim() || null;
}

/** Tells the bakery a paid order has come in. */
export async function sendOrderNotificationEmail(order: OrderDTO): Promise<void> {
  const to = bakeryInbox();
  if (!to) {
    console.warn(`Order #${order.number} is paid, but no ORDER_NOTIFY_EMAIL is set to notify.`);
    return;
  }

  const pickup = formatPickupDate(order.pickupDate);

  const text = [
    `New paid order #${order.number} — ${formatCents(order.totalCents)}`,
    ``,
    `Pickup: ${pickup}`,
    `Customer: ${order.email}`,
    `Phone: ${order.phone}`,
    ...(order.payerPhone ? [`Paid from Whish account: ${order.payerPhone}`] : []),
    ...(order.note ? [`Note: ${order.note}`] : []),
    ``,
    ...orderLinesText(order),
    ``,
    `Total paid: ${formatCents(order.totalCents)}`,
  ].join('\n');

  const html = orderShell(`
    <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8a6a58;text-align:center">New paid order</p>
    <p style="margin:0 0 24px;font-size:24px;text-align:center">#${order.number} · ${formatCents(order.totalCents)}</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6">
      <strong>Pickup:</strong> ${escapeHtml(pickup)}<br>
      <strong>Customer:</strong> ${escapeHtml(order.email)}<br>
      <strong>Phone:</strong> ${escapeHtml(order.phone)}
      ${order.payerPhone ? `<br><strong>Paid from Whish account:</strong> ${escapeHtml(order.payerPhone)}` : ''}
      ${order.note ? `<br><strong>Note:</strong> ${escapeHtml(order.note)}` : ''}
    </p>
    ${orderRowsHtml(order)}`);

  await sendMail({
    to,
    subject: `${testPrefix(order)}New paid order #${order.number} — pickup ${pickup}`,
    text,
    html,
  });
}

export { isConfigured as isMailConfigured };
