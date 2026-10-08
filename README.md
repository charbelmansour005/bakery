# La Belle Fournée

An artisan sourdough bakery site — a public storefront that renders live product
data from MongoDB, plus a deliberately narrow CMS so the bakery can change
prices, swap loaf photos and add seasonal products without a developer.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · MongoDB + Mongoose · JWT auth (`jose`) · Whish Money payments

---

## Setup

### 1. Node 22

The repo pins Node 22 in `.nvmrc`. Tailwind v4 requires Node 20+, so this matters.

```bash
nvm use
```

### 2. Install

```bash
npm install
```

### 3. Environment

Copy the example and fill it in:

```bash
cp .env.example .env.local
```

| Variable | What it is |
|---|---|
| `MONGODB_URI` | MongoDB connection string. The database name is part of the URI. |
| `ADMIN_USERNAME` | Username for the single admin account. |
| `ADMIN_PASSWORD` | Admin password. Bcrypt-hashed by the seed script — never stored in plaintext. |
| `SESSION_SECRET` | Signs the session JWT. Generate with `openssl rand -base64 32`. |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Optional. Overrides the number in `lib/config.ts`. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` | Nodemailer, for customer sign-in codes and order emails. Unset in dev prints the message to the server console; production refuses to sign anyone in without it. |
| `WHISH_BASE_URL` / `WHISH_CHANNEL` / `WHISH_SECRET` / `WHISH_WEBSITE_URL` | Whish Money. Optional — with any missing, online payment is off. See [Payments](#payments). |
| `SITE_URL` | The public origin Whish calls back to. Set in production; unset locally. |
| `ORDER_NOTIFY_EMAIL` | Optional. Where "new paid order" emails go. Defaults to `SMTP_USER`. |

If you use MongoDB Atlas, add your IP to the cluster's Network Access allowlist,
or the seed will hang and then fail with a server-selection timeout.

### 4. Seed

```bash
npm run seed
```

Inserts the 8 menu products and the one admin user. **Safe to re-run** — products
are upserted on `name`, so re-seeding never overwrites prices or images you've
edited in the CMS. It does reset the admin password to the current `ADMIN_PASSWORD`.

### 5. Run

```bash
npm run dev
```

- Storefront — http://localhost:3000
- Menu — http://localhost:3000/menu
- CMS — http://localhost:3000/admin/login

---

## What's here

### Public site

`/` and `/menu` are `force-dynamic`, so anything changed in the CMS is visible on
the next page load with no rebuild.

Every ordered item carries its own loaf: an order is a list of lines, each a
plain loaf or a topping on the loaf the customer picked for it (see
[Accounts and the cart](#accounts-and-the-cart)). "Review Order" opens a dialog
with the two ways to place it: pay through Whish, or "Cash on delivery", which
sends the order to the bakery over WhatsApp to be paid for in person. Choosing
Whish leads to `/cart`, which is also the checkout — the customer picks a pickup
day and pays (see [Payments](#payments)). Until Whish is configured, the dialog
shows it as "Coming soon" and cash on delivery is the only choice that can be
taken.

The "Have an Idea?" form also goes over WhatsApp: submitting opens a chat with
the idea written in. Nothing is stored. Both use the number in `lib/config.ts`.

### CMS

One admin. Log in at `/admin/login`, then see paid orders at `/admin/orders`
(soonest pickup first; mark each one done when it is handed over), manage
products at `/admin/products` (add, edit, delete, replace images) and the hero photograph and text plus the Our Story text and photographs at
`/admin/story`.

Auth is a signed JWT in an httpOnly cookie. `middleware.ts` does an optimistic
check so a signed-out admin gets redirected rather than seeing a flash of the
dashboard, but the decision that actually matters is `requireAdmin()` /
`requireAdminApi()` in `lib/auth.ts`, called next to the data. Middleware is not
treated as an authorization boundary.

### API

| Route | Access |
|---|---|
| `GET /api/products` | Public |
| `POST /api/products` | Admin |
| `PATCH` / `DELETE /api/products/:id` | Admin |
| `POST /api/upload` | Admin |
| `GET /api/media/:file` | Public (serves uploaded images) |
| `POST /api/auth/login` · `POST /api/auth/logout` | Admin session |
| `POST /api/account/request-code` · `verify-code` · `logout` | Public (rate limited) |
| `GET` / `PUT` / `DELETE /api/cart` | Signed-in customer |
| `POST /api/checkout` | Signed-in customer |
| `GET /api/whish/callback` | Public — called by Whish; trusts nothing in the request |
| `PATCH /api/orders/:id` | Admin |
| `GET /api/story` | Public |
| `PATCH /api/story` | Admin |

---

## Accounts and the cart

Two separate audiences, two separate sessions.

**Customers** sign in with a 6-digit code emailed by Nodemailer. Signing up and
signing in are the same flow — the first verified code for an unseen address
creates the account. There are no customer passwords to store, reset or leak.

An account is required to order, so the cart itself requires sign-in: tapping a
product while signed out redirects to `/account/login?from=…` and returns you
afterwards. There is no guest cart and no merge step.

### The shape of an order

A cart is a list of lines. Each line is a loaf, optionally with one topping
folded through it, priced as topping + loaf:

| Line | Price |
|---|---|
| Multigrain $2.00 + Classic $4 | $6.00 |
| Chocolate $3.00 + Whole Wheat $5 | $8.00 |
| **Total** | **$14.00** |

- **Each topping at most once** — Chocolate cannot be on both Classic and Whole
  Wheat. Choosing the other loaf *moves* it.
- **Each plain loaf at most once.**
- **A loaf can appear on several lines** — a plain Classic and a
  Multigrain-on-Classic are two different items.

A line's key is its topping's id, or its loaf's id when plain. Product ids are
unique across the menu, so the single rule "keys are unique" enforces both
limits. The server rejects a duplicate outright rather than de-duplicating it:
with two loaves for one topping, picking which one the customer meant would be a
guess.

### Storage

The cart lives in MongoDB, one per customer, so it survives a reload and follows
them between devices. It stores product *ids* and resolves them on read — a
price edited in the CMS is immediately the price the customer sees, and a line
whose loaf or topping is deleted from the menu drops out (a topping line is never
silently turned into a plain loaf).

Writes replace the whole cart rather than sending a diff, so two rapid taps
cannot interleave. The cost of that design is that a *stale* client could write
an old cart back; so writes use `keepalive` (they survive the page unloading),
and after hydration the client re-reads the cart and adopts it unless the
customer has already changed something.

Carts saved before per-line loaves (`{ base, addOns }`) read as empty, and the
next write removes those fields.

### Why the two sessions cannot be confused

Admin and customer tokens are signed with the same `SESSION_SECRET`, so without
care a customer token would satisfy an admin check. Three independent guards, in
`lib/jwt.ts`:

1. Separate cookies — `bakery_admin` and `bakery_customer`.
2. `aud` is set to the role and verification passes `audience`, so `jose` itself
   rejects a cross-role token before our code sees the payload.
3. The `role` claim is re-checked against what the caller asked for.

Admin sessions last 8 hours; customer sessions last 30 days.

### Sign-in code handling

Codes are 6 digits — only ~20 bits, so the protection is the limits around them,
not their entropy: bcrypt-hashed at rest, single use, 10-minute expiry, 5 wrong
attempts before the code dies, and 5 requests per address per 15 minutes so the
endpoint cannot be used to mail-bomb. Requesting a code returns the same
response whether or not the address is registered, so it cannot enumerate
customers. Expired rows are removed by a MongoDB TTL index rather than a sweeper.

---

## Payments

Online payment goes through [Whish Money](https://whish.money). It is optional:
with the `WHISH_*` variables unset, orders still go over WhatsApp and the
"Review Order" dialog announces Whish as "Coming soon", so the code can be
deployed ahead of the credentials. Setting the variables is the switch —
there is no separate flag to flip.

### The flow

```
/cart ── POST /api/checkout ──▶ Order created (pending) ──▶ Whish: payment/whish ──▶ payment page URL
browser ──▶ Whish's payment page ──▶ customer pays
Whish ── GET /api/whish/callback ──▶ settleOrder() ─┐
browser ──▶ /orders/:id ──▶ settleOrder()           ─┴─▶ asks Whish for the status ──▶ paid | failed | pending
```

An **order** is one attempt to pay for a cart. It is written before Whish is
called, with a snapshot of names and prices — unlike the cart, it must not
change when the menu does. Its number (`#1001`, `#1002`, …) is also the
`externalId` given to Whish, which must be numeric and never repeat, so it comes
from an atomic counter that is never reset.

### The one rule

**An order is paid only when Whish says so, to us, server to server.**

Whish's callback is an unsigned `GET`. Anyone who learned its URL could call it,
so nothing in it is believed — not the order's fate, and certainly not an
amount. Both the callback and the customer's return to `/orders/:id` do the same
single thing: call `settleOrder()` in `lib/orders.ts`, which asks Whish for the
payment's status by `externalId` and records the answer.

- The amount charged is the one stored on the order, built from the server's
  copy of the cart. No price ever comes from the browser or from a URL.
- The move to `paid` is one conditional update, so when the callback and the
  customer's return land together, exactly one wins and sends the emails.
- A response from Whish that is not recognised counts as `pending`. A change on
  their side can delay a confirmation; it cannot mark an unpaid order paid.
- A `failed` order is asked about again rather than skipped — Whish lets a
  customer retry on its page, so a failure can be followed by a success.
- Opening `/admin/orders` re-checks recent unpaid orders, which covers the last
  gap: paid, callback lost, tab closed.

When an order becomes paid, the lines it covered leave the cart (only those —
something added in another tab meanwhile was not paid for), the customer gets a
receipt, and the bakery gets a notification email.

### Sandbox and live

They differ only by the four `WHISH_*` values. Orders are tagged `test` or
`live` from `WHISH_BASE_URL` (a host containing `sandbox`, or `localhost`, is
test), and `/admin/orders` lists only the current mode — worth knowing because
local development and production share one database.

### Checking credentials

```bash
npm run whish:check
```

Calls balance, opens a 1.00 USD payment and reads its status back, printing
exactly what Whish answers. It uses the same request code as the site
(`lib/whish-api.ts`) and never prints the secret. Run it first whenever the
credentials or base URL change.

Whish publishes no public API reference. `payment/whish` is confirmed by a
working integration; the status call (`payment/collect/status`) is built from
secondary sources, and this script is what confirms it. If the sandbox
disagrees, the fix is confined to `PATHS` and `readStatus()` in
`lib/whish-api.ts`.

### Developing without credentials

```bash
npm run whish:mock
```

A local stand-in for Whish on port 4010, with a payment page offering each
outcome worth testing: approve, decline, approve with the callback lost,
approve with the callback delivered twice, and leaving without paying. Start the
site against it with:

```bash
WHISH_BASE_URL=http://localhost:4010 WHISH_CHANNEL=mock WHISH_SECRET=mock WHISH_WEBSITE_URL=localhost npm run dev
```

It is a script, not a route — it is never part of the deployed site.

### Going live

1. Put the sandbox values in `.env.local` and run `npm run whish:check`.
2. Pay one sandbox order end to end on `localhost`.
3. Add the four `WHISH_*` values and `SITE_URL=https://www.labellefournee.com`
   in Vercel, redeploy, and pay one sandbox order on the live domain — this is
   the first time Whish's callback can actually reach the site.
4. Replace the sandbox values with the live ones and redeploy.

Not handled here: refunds (issue them from the Whish app) and the Whish fee,
which the bakery absorbs — the customer pays the menu total.

---

## Uploads

Image uploads have two backends, picked by environment — one function, one
stored URL shape per backend:

| Environment | Where uploads go | Stored `imageUrl` |
|---|---|---|
| Vercel (`BLOB_READ_WRITE_TOKEN` set) | Vercel Blob | `https://<store>.public.blob.vercel-storage.com/<uuid>.jpg` |
| Local dev (no token) | `./uploads/` (gitignored) | `/api/media/<uuid>.jpg` |

**Why not `public/uploads/`?** Next indexes the `public/` folder once at boot in
production and caches negative lookups, so a file written there after startup
404s under `next build && next start` until the server restarts — while working
perfectly in `next dev`. A route handler behaves identically in both.

**Why Blob on Vercel?** Its filesystem is ephemeral. Anything written to disk is
gone on the next deploy, so uploads have to leave the container.

Seeded products still point at static files in `public/images/`, so `imageUrl`
can hold any of three shapes and every reader copes with all of them.

Uploads are capped at 4 MB and limited to JPEG, PNG and WebP. The stored
extension comes from the file's MIME type, never its filename, and filenames are
UUIDs.

---

## Product images

Seeded photos live in `public/images/`. To replace one, either upload it through
the CMS or drop a file over the existing name:

`classic.jpg` · `whole-wheat.jpg` · `zaatar.jpg` · `olive.jpg` ·
`multigrain.jpg` · `chocolate.jpg` · `cinnamon.jpg` · `la-belle-signature.jpg` ·
`hero-chocolate-sourdough.jpg`

---

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run seed` | Seed products + admin (idempotent) |
| `npm run whish:check` | Smoke-test the Whish credentials in `.env.local` |
| `npm run whish:mock` | Local stand-in for Whish, for development |
| `npm run lint` | ESLint |

---

## Not built, on purpose

No refunds from the site · no stock limits or sold-out days · no delivery, pickup
only · no email on the ideas form · one admin, no roles.
