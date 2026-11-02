import type { CSSProperties } from 'react';

/**
 * The hero's sourdough story, drawn in code: a starter jar that bubbles and
 * rises, dough that gathers into a round loaf, a loaf that is scored, baked and
 * steaming.
 *
 * This component has no logic at all. Every movement is CSS reading three
 * numbers, --p1, --p2 and --p3 (how far through each stage the visitor has
 * scrolled, 0 to 1), which HeroScroll sets on the hero. The rules live in
 * globals.css under `.dough-scene`. With reduced motion the numbers are all 1,
 * so the same drawing shows the finished loaf — no second version to maintain.
 *
 * Purely decorative: the headline beside it says everything it says.
 */

/** A per-element number the stylesheet reads: where it starts, how far it travels. */
type Motion = CSSProperties & Record<`--${string}`, string | number>;

// cx, cy, r, how far it rises (px), and the fraction of stage 1 it lives in.
const BUBBLES: [number, number, number, number, number, number][] = [
  [160, 278, 6, -70, 0.0, 0.8],
  [190, 286, 4, -92, 0.05, 0.9],
  [222, 274, 7, -112, 0.1, 0.85],
  [246, 284, 4, -62, 0.15, 0.95],
  [172, 264, 5, -100, 0.2, 0.9],
  [206, 291, 5, -124, 0.25, 1.0],
  [236, 260, 4, -82, 0.3, 0.95],
  [152, 289, 4, -92, 0.35, 1.0],
  [252, 292, 6, -138, 0.4, 1.0],
];

// cx, cy, r, how far it drifts up (px), and the fraction of stage 2 it lives in.
const FLOUR: [number, number, number, number, number, number][] = [
  [120, 268, 2.2, -58, 0.05, 0.9],
  [146, 232, 1.6, -74, 0.12, 0.95],
  [178, 214, 2.4, -66, 0.2, 1.0],
  [214, 204, 1.8, -84, 0.1, 0.9],
  [248, 218, 2.2, -62, 0.25, 1.0],
  [276, 246, 1.6, -78, 0.15, 0.95],
  [292, 274, 2.4, -54, 0.3, 1.0],
  [136, 290, 1.8, -70, 0.35, 1.0],
];

// Where each wisp of steam starts (fraction of stage 3) and its path.
const STEAM: { d: string; start: number }[] = [
  { d: 'M168 170 C156 152 180 142 168 122 C160 108 176 100 172 88', start: 0.45 },
  { d: 'M200 164 C188 144 214 134 200 112 C192 98 208 88 204 74', start: 0.55 },
  { d: 'M232 170 C220 152 244 142 232 122 C224 108 240 100 236 88', start: 0.65 },
];

export default function DoughScene({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 340"
      aria-hidden="true"
      focusable="false"
      className={`dough-scene ${className}`}
    >
      <defs>
        <radialGradient id="ds-dough" cx="0.4" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#F5E9CC" />
          <stop offset="1" stopColor="#D8C59B" />
        </radialGradient>
        <radialGradient id="ds-crust" cx="0.38" cy="0.28" r="0.85">
          <stop offset="0" stopColor="#E6AE5A" />
          <stop offset="0.55" stopColor="#B87629" />
          <stop offset="1" stopColor="#74401A" />
        </radialGradient>
        <linearGradient id="ds-starter" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F4E8C8" />
          <stop offset="1" stopColor="#E2CFA2" />
        </linearGradient>
        <radialGradient id="ds-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#E8B65A" stopOpacity="1" />
          <stop offset="0.6" stopColor="#C9A84C" stopOpacity="0.55" />
          <stop offset="1" stopColor="#C9A84C" stopOpacity="0" />
        </radialGradient>
        <clipPath id="ds-jar-clip">
          <rect x="136" y="106" width="128" height="188" rx="16" />
        </clipPath>
      </defs>

      {/* The glow behind it all warms up as the loaf bakes. */}
      <circle className="ds-glow" cx="200" cy="170" r="168" fill="url(#ds-glow)" />
      <circle
        className="ds-ring"
        cx="200"
        cy="170"
        r="160"
        fill="none"
        stroke="#C9A84C"
        strokeOpacity="0.4"
        strokeWidth="1.5"
        strokeDasharray="2 11"
        strokeLinecap="round"
      />

      {/* The bench everything sits on. */}
      <rect x="70" y="300" width="260" height="5" rx="2.5" fill="#C9A84C" fillOpacity="0.55" />
      <ellipse className="ds-shadow" cx="200" cy="304" rx="112" ry="9" fill="#000" />

      {/* 1 — Naturally fermented */}
      <g className="ds-jar">
        <rect
          x="130"
          y="98"
          width="140"
          height="202"
          rx="24"
          fill="#F6F1E7"
          fillOpacity="0.07"
          stroke="#F6F1E7"
          strokeOpacity="0.62"
          strokeWidth="3"
        />
        <g clipPath="url(#ds-jar-clip)">
          <rect
            className="ds-starter"
            x="136"
            y="146"
            width="128"
            height="148"
            rx="14"
            fill="url(#ds-starter)"
          />
          {BUBBLES.map(([cx, cy, r, rise, s, e]) => (
            <circle
              key={`${cx}-${cy}`}
              className="ds-bubble"
              cx={cx}
              cy={cy}
              r={r}
              fill="#FFF8E6"
              fillOpacity="0.8"
              stroke="#BFA66E"
              strokeWidth="1"
              style={{ '--rise': `${rise}px`, '--s': s, '--e': e } as Motion}
            />
          ))}
        </g>
        {/* The rubber band marking where the starter began. */}
        <rect x="130" y="228" width="140" height="7" fill="#C9A84C" />
        {/* Lid, and a streak of light down the glass. */}
        <rect x="122" y="84" width="156" height="16" rx="8" fill="none" stroke="#C9A84C" strokeWidth="3" />
        <path d="M146 124v112" stroke="#fff" strokeOpacity="0.28" strokeWidth="5" strokeLinecap="round" />
      </g>

      {/* 2 — Hand shaped: a loose lump gathers into a loaf. */}
      <path
        className="ds-blob"
        d="M104 270C98 240 118 216 150 210C170 192 216 190 240 204C270 202 300 224 300 254C306 282 286 300 252 300L150 300C120 300 108 290 104 270Z"
        fill="url(#ds-dough)"
      />
      <ellipse className="ds-boule" cx="200" cy="240" rx="100" ry="60" fill="url(#ds-dough)" />
      {FLOUR.map(([cx, cy, r, rise, s, e]) => (
        <circle
          key={`${cx}-${cy}`}
          className="ds-flour"
          cx={cx}
          cy={cy}
          r={r}
          fill="#F6F1E7"
          style={{ '--rise': `${rise}px`, '--s': s, '--e': e } as Motion}
        />
      ))}

      {/* 3 — Baked fresh: the crust takes over, the score opens, steam rises. */}
      <ellipse className="ds-crust" cx="200" cy="240" rx="100" ry="60" fill="url(#ds-crust)" />
      <ellipse
        className="ds-sheen"
        cx="160"
        cy="212"
        rx="36"
        ry="11"
        fill="#fff"
      />
      <path
        className="ds-score"
        pathLength={1}
        d="M146 230Q200 192 258 226"
        fill="none"
        stroke="#F6E6BE"
        strokeWidth="6"
        strokeLinecap="round"
      />
      {STEAM.map(({ d, start }) => (
        <path
          key={d}
          className="ds-steam"
          d={d}
          fill="none"
          stroke="#F6F1E7"
          strokeWidth="4"
          strokeLinecap="round"
          style={{ '--s': start } as Motion}
        />
      ))}
    </svg>
  );
}
