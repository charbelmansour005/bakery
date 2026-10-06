import StoryForm from '@/components/admin/StoryForm';
import { requireAdmin } from '@/lib/auth';
import { getStory } from '@/lib/story';

export const dynamic = 'force-dynamic';

export default async function StoryAdminPage() {
  await requireAdmin();
  const story = await getStory();

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Hero &amp; Story</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        The hero photograph and text, and the text and photographs of the Our Story section, on the landing page.
      </p>

      <StoryForm story={story} />
    </div>
  );
}
