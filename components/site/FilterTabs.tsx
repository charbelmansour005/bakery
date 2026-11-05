'use client';

export const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'base', label: 'Base Loaves' },
  { key: 'savory', label: 'Savory' },
  { key: 'sweet', label: 'Sweet' },
  { key: 'crackers', label: 'Crackers' },
] as const;

export type FilterKey = (typeof FILTERS)[number]['key'];

export default function FilterTabs({
  active,
  onChange,
}: {
  active: FilterKey;
  onChange: (key: FilterKey) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2.5" role="tablist" aria-label="Filter the menu">
      {FILTERS.map((filter) => {
        const selected = filter.key === active;
        return (
          <button
            key={filter.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(filter.key)}
            className={`rounded-full border px-5 py-2 text-xs font-semibold tracking-wide transition ${
              selected
                ? 'border-gold bg-gold text-walnut'
                : 'border-gold/40 bg-transparent text-walnut-400 hover:border-gold hover:text-walnut'
            }`}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}
