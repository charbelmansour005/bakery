import mongoose, { Schema, type Model, type InferSchemaType } from 'mongoose';

/**
 * A singleton: the Our Story section is one piece of content, not a list.
 *
 * `singleton` is a constant discriminator with a unique index, so an upsert
 * filtered on it can only ever create or update one document — there is no way
 * to end up with two competing story records, even under a concurrent write.
 */
const storyImageSchema = new Schema(
  {
    url: { type: String, required: true, default: '', trim: true },
    alt: { type: String, required: true, default: '', trim: true },
  },
  { _id: false },
);

const storySchema = new Schema(
  {
    singleton: { type: String, required: true, unique: true, default: 'story' },
    primary: { type: storyImageSchema, required: true, default: () => ({ url: '', alt: '' }) },
    secondary: { type: storyImageSchema, required: true, default: () => ({ url: '', alt: '' }) },
    /** The landing page's hero photograph. Lives here so the page has one content document. */
    hero: { type: storyImageSchema, required: true, default: () => ({ url: '', alt: '' }) },
    // Not `required`: a required String rejects '', and with `upsert` Mongoose
    // validates as though inserting — the same trap the photos hit. Empty means
    // "never saved", and lib/story.ts falls back to the defaults in lib/config.ts.
    heading: { type: String, default: '', trim: true },
    /** Paragraphs separated by a blank line. */
    body: { type: String, default: '', trim: true },
  },
  { timestamps: true },
);

export type StoryDoc = InferSchemaType<typeof storySchema>;

const Story =
  (mongoose.models.Story as Model<StoryDoc>) ||
  mongoose.model<StoryDoc>('Story', storySchema);

export const STORY_SINGLETON = 'story';
export default Story;
