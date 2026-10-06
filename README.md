# La Belle Fournée

An artisan sourdough bakery site — a public storefront that renders live product
data from MongoDB, plus a deliberately narrow CMS so the bakery can change
prices, swap loaf photos and add seasonal products without a developer.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · MongoDB + Mongoose · JWT auth (`jose`)

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
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` | Nodemailer, for customer sign-in codes. Unset in dev prints the code to the server console; production refuses to sign anyone in without it. |

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
[Accounts and the cart](#accounts-and-the-cart)). The cart icon in the nav opens
`/cart`. There is no checkout — "Review Order" opens a WhatsApp chat with the
order pre-filled.

The "Have an Idea?" form also goes over WhatsApp: submitting opens a chat with
the idea written in. Nothing is stored. Both use the number in `lib/config.ts`.

### CMS

One admin. Log in at `/admin/login`, then manage products at `/admin/products`
(add, edit, delete, replace images) and the hero photograph and text plus the Our Story text and photographs at
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
| `npm run lint` | ESLint |

---

## Not built, on purpose

No payment or checkout · no order persistence or history (the cart is not an
order) · no email on the ideas form · one admin, no roles.
