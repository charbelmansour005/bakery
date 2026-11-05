import mongoose, { Schema, type Model, type InferSchemaType } from 'mongoose';

/**
 * A cracker pack size. Edited at /admin/crackers. The flavors are ordinary
 * products in the "cracker" category; a pack says how much it costs and how
 * many of them can go in it.
 */
const crackerPackSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    grams: { type: Number, required: true, min: 1 },
    /** integer cents */
    price: { type: Number, required: true, min: 0 },
    maxFlavors: { type: Number, required: true, min: 1, default: 1 },
    sortOrder: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

export type CrackerPackDoc = InferSchemaType<typeof crackerPackSchema>;

const CrackerPack =
  (mongoose.models.CrackerPack as Model<CrackerPackDoc>) ||
  mongoose.model<CrackerPackDoc>('CrackerPack', crackerPackSchema);

export default CrackerPack;
