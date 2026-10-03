import { BAKERY } from '@/lib/config';

const INSTAGRAM_PATH =
  'M12 2.2c3.2 0 3.6 0 4.9.07 1.2.06 1.8.25 2.2.42.6.22 1 .48 1.4.9.42.4.68.8.9 1.4.17.4.36 1 .42 2.2.07 1.3.07 1.7.07 4.9s0 3.6-.07 4.9c-.06 1.2-.25 1.8-.42 2.2a3.9 3.9 0 01-.9 1.4c-.4.42-.8.68-1.4.9-.4.17-1 .36-2.2.42-1.3.07-1.7.07-4.9.07s-3.6 0-4.9-.07c-1.2-.06-1.8-.25-2.2-.42a3.9 3.9 0 01-1.4-.9 3.9 3.9 0 01-.9-1.4c-.17-.4-.36-1-.42-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.9c.06-1.2.25-1.8.42-2.2.22-.6.48-1 .9-1.4.4-.42.8-.68 1.4-.9.4-.17 1-.36 2.2-.42C8.4 2.2 8.8 2.2 12 2.2zm0 3.2A6.6 6.6 0 1018.6 12 6.6 6.6 0 0012 5.4zm0 10.9A4.3 4.3 0 1116.3 12 4.3 4.3 0 0112 16.3zm6.9-11.1a1.55 1.55 0 11-1.55-1.55A1.55 1.55 0 0118.9 5.2z';

export default function Footer() {
  return (
    <footer className="bg-walnut text-cream">
      {/* pb-28 keeps the last row clear of the fixed order bar. */}
      <div className="mx-auto max-w-6xl px-6 pt-14 pb-28 lg:px-10">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-display text-3xl tracking-tight">{BAKERY.name}</p>
            <p className="eyebrow mt-3 text-gold">{BAKERY.footerTagline}</p>
          </div>

          {/* Instagram is the bakery's only social account. */}
          <a
            href={`https://instagram.com/${BAKERY.instagram}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 self-start text-cream/70 transition hover:text-gold sm:self-auto"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-cream/25 transition group-hover:border-gold">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                <path d={INSTAGRAM_PATH} />
              </svg>
            </span>
            <span className="eyebrow">@{BAKERY.instagram}</span>
          </a>
        </div>

        <div className="mt-10 h-px w-full bg-cream/15" />

        <div className="mt-6 flex flex-col gap-3 text-sm text-cream/60 sm:flex-row sm:items-center sm:justify-between">
          <p>
            {BAKERY.phone} · {BAKERY.address}
          </p>
          <p>
            © {new Date().getFullYear()} {BAKERY.legal}
          </p>
        </div>

        {/* Studio credit. Plain text until the studio has a public URL to link. */}
        <p className="mt-6 text-center text-xs tracking-wide text-cream/40 sm:text-right">
          Developed by <span className="text-cream/60">Runtime Collective</span>
        </p>
      </div>
    </footer>
  );
}
