'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { StoryDTO } from '@/types/story';
import ImageUploadField from './ImageUploadField';

const FIELD =
  'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none';

function Slot({
  title,
  hint,
  ratio,
  value,
  onChange,
  idPrefix,
}: {
  title: string;
  hint: string;
  ratio: string;
  value: { url: string; alt: string };
  onChange: (next: { url: string; alt: string }) => void;
  idPrefix: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 mb-5 text-sm text-slate-500">
        {hint} Cropped to <span className="font-medium text-slate-700">{ratio}</span>.
      </p>

      <ImageUploadField value={value.url} onChange={(url) => onChange({ ...value, url })} />

      <div className="mt-5">
        <label htmlFor={`${idPrefix}-alt`} className="block text-sm font-medium text-slate-700">
          Alt text
        </label>
        <input
          id={`${idPrefix}-alt`}
          value={value.alt}
          onChange={(event) => onChange({ ...value, alt: event.target.value })}
          maxLength={200}
          className={FIELD}
        />
        <p className="mt-1 text-xs text-slate-500">
          Describe what is happening in the photo, for screen readers and when the image fails to load.
        </p>
      </div>
    </div>
  );
}

export default function StoryForm({ story }: { story: StoryDTO }) {
  const router = useRouter();
  const [heading, setHeading] = useState(story.heading);
  const [body, setBody] = useState(story.body);
  const [primary, setPrimary] = useState(story.primary);
  const [secondary, setSecondary] = useState(story.secondary);
  const [hero, setHero] = useState(story.hero);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);

    const response = await fetch('/api/story', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ heading, body, primary, secondary, hero }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? 'Could not save the story.');
      setBusy(false);
      return;
    }

    setSaved(true);
    setBusy(false);
    // Pull the public page's cached render forward so the change is visible.
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Slot
        idPrefix="hero"
        title="Hero photograph"
        hint="The full-width photo at the top of the landing page, shown darkened behind the headline. Use a wide, landscape image at least 2000px across."
        ratio="the screen, keeping the centre"
        value={hero}
        onChange={setHero}
      />

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Story text</h2>
        <p className="mt-1 mb-5 text-sm text-slate-500">
          The heading and paragraphs beside the photographs.
        </p>

        <label htmlFor="story-heading" className="block text-sm font-medium text-slate-700">
          Heading
        </label>
        <input
          id="story-heading"
          value={heading}
          onChange={(event) => setHeading(event.target.value)}
          required
          maxLength={120}
          className={FIELD}
        />

        <label htmlFor="story-body" className="mt-5 block text-sm font-medium text-slate-700">
          Text
        </label>
        <textarea
          id="story-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          required
          rows={8}
          maxLength={2000}
          className={FIELD}
        />
        <p className="mt-1 text-xs text-slate-500">
          Leave a blank line between paragraphs.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Slot
          idPrefix="primary"
          title="Left photograph"
          hint="The larger of the pair."
          ratio="4:5 portrait"
          value={primary}
          onChange={setPrimary}
        />
        <Slot
          idPrefix="secondary"
          title="Right photograph"
          hint="The smaller one, set lower than the first."
          ratio="3:4 portrait"
          value={secondary}
          onChange={setSecondary}
        />
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save changes'}
        </button>
        {saved && !busy && (
          <p role="status" className="text-sm text-green-700">
            Saved — the landing page is updated.
          </p>
        )}
      </div>
    </form>
  );
}
