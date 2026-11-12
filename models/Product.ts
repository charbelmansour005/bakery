import mongoose, { Schema, type Model, type InferSchemaType } from 'mongoose';
import { CATEGORIES } from '@/types/product';

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, enum: CATEGORIES },
    // Not `required`: a required String rejects '', and an empty description (or
    // no photo yet) is a normal state — every cracker flavor starts that way.
    // Mongoose treats '' as missing, so `required` made saving such a product
    // fail with an opaque 500. The API schema already guarantees a string.
    description: { type: String, trim: true, default: '' },
    /** integer cents */
    price: { type: Number, required: true, min: 0 },
    imageUrl: { type: String, trim: true, default: '' },
    sortOrder: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

export type ProductDoc = InferSchemaType<typeof productSchema>;

// The `models.Product ||` guard prevents OverwriteModelError when Next's hot
// reload re-evaluates this module. Note: schema edits need a dev-server restart.
const Product =
  (mongoose.models.Product as Model<ProductDoc>) ||
  mongoose.model<ProductDoc>('Product', productSchema);

export default Product;
