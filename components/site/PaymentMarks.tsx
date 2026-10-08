import Image from 'next/image';

/**
 * The marks shown beside the two ways to pay: Whish's own logo, and a delivery
 * rider for cash on delivery. Both are decorative — the option's name is always
 * written next to them — so neither is announced to screen readers.
 */

/** Whish Money's logo, as supplied: a square tile, so it is only ever rounded, never recoloured. */
export function WhishLogo({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <Image
      src="/images/whish.jpg"
      alt=""
      width={size}
      height={size}
      // A few kilobytes, and usually inside a dialog that is hidden until
      // opened: fetched up front so it is there the moment the dialog is.
      loading="eager"
      className={`shrink-0 ${size >= 32 ? 'rounded-lg' : 'rounded'} ${className}`}
    />
  );
}

/** A rider on a scooter with a delivery box behind them. Drawn in the current text colour. */
export function DeliveryIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {/* wheels */}
      <circle cx="7.5" cy="24.5" r="3.5" />
      <circle cx="25" cy="24.5" r="3.5" />
      {/* delivery box on the rear rack */}
      <rect x="2.5" y="10.5" width="7.5" height="7" rx="1" />
      {/* rack and seat */}
      <path d="M3 20.5h10.5" />
      {/* floorboard, leg shield and fork */}
      <path d="M11 24.5h7l3.2-10" />
      <path d="M21.2 14.5 25 24.5" />
      {/* handlebar */}
      <path d="M19.2 13.2h4.2" />
      {/* rider: helmet, back and leg, arm */}
      <circle cx="14.6" cy="5.2" r="2.4" />
      <path d="M14.4 9.8 12.8 19.8h4.4l1 4" />
      <path d="M14.2 12.2l5.2 1.6" />
    </svg>
  );
}

/** The rider on a walnut tile, sized to sit beside the Whish logo as its pair. */
export function DeliveryMark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-walnut text-cream ${className}`}
    >
      <DeliveryIcon className="h-7 w-7" />
    </span>
  );
}
