import mongoose, { Schema, type Model } from 'mongoose';

/**
 * Named, monotonically increasing sequences.
 *
 * Order numbers come from here rather than from a timestamp or the ObjectId
 * because the number is also what we give Whish as `externalId`, which has to
 * be numeric and must never repeat. `$inc` is atomic, so two checkouts landing
 * together still get different numbers. Never reset this.
 */
type CounterDoc = { _id: string; seq: number };

const counterSchema = new Schema<CounterDoc>({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
});

const Counter =
  (mongoose.models.Counter as Model<CounterDoc>) ||
  mongoose.model<CounterDoc>('Counter', counterSchema);

export default Counter;
