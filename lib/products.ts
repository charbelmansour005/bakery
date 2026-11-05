import 'server-only';
import { cache } from 'react';
import { isValidObjectId, type Types } from 'mongoose';
import dbConnect from './db';
import Product from '@/models/Product';
import type { Category, ProductDTO } from '@/types/product';
import type { ProductCreateInput, ProductUpdateInput } from './validation';

/**
 * The only way product data leaves the server. Everything returned from this
 * module is a plain ProductDTO, because `.lean()` alone is NOT enough — `_id`
 * stays a bson ObjectId, which throws "Only plain objects can be passed to
 * Client Components from Server Components".
 */

type LeanProduct = {
  _id: Types.ObjectId;
  name: string;
  category: Category;
  description: string;
  price: number;
  imageUrl: string;
  sortOrder: number;
};

function toProductDTO(doc: LeanProduct): ProductDTO {
  return {
    id: doc._id.toString(),
    name: doc.name,
    category: doc.category,
    description: doc.description ?? '',
    price: doc.price,
    imageUrl: doc.imageUrl ?? '',
    sortOrder: doc.sortOrder ?? 0,
  };
}

/** Wrapped in React `cache` so a page rendering several sections hits Mongo once. */
export const getProducts = cache(async (): Promise<ProductDTO[]> => {
  await dbConnect();
  const docs = await Product.find({})
    .sort({ sortOrder: 1, name: 1 })
    .lean<LeanProduct[]>();
  return docs.map(toProductDTO);
});

export async function getProductById(id: string): Promise<ProductDTO | null> {
  // Guard first: an invalid id makes Mongoose throw a CastError (500) rather
  // than simply not matching (404).
  if (!isValidObjectId(id)) return null;
  await dbConnect();
  const doc = await Product.findById(id).lean<LeanProduct | null>();
  return doc ? toProductDTO(doc) : null;
}

export async function createProduct(input: ProductCreateInput): Promise<ProductDTO> {
  await dbConnect();
  const doc = await Product.create(input);
  return toProductDTO(doc.toObject() as LeanProduct);
}

export async function updateProduct(
  id: string,
  input: ProductUpdateInput,
): Promise<ProductDTO | null> {
  if (!isValidObjectId(id)) return null;
  await dbConnect();
  const doc = await Product.findByIdAndUpdate(id, input, {
    new: true,
    runValidators: true,
  }).lean<LeanProduct | null>();
  return doc ? toProductDTO(doc) : null;
}

export async function deleteProduct(id: string): Promise<boolean> {
  if (!isValidObjectId(id)) return false;
  await dbConnect();
  const result = await Product.findByIdAndDelete(id).lean<LeanProduct | null>();
  return result !== null;
}

/** Convenience for the public pages. */
export function groupByCategory(products: ProductDTO[]) {
  return {
    base: products.filter((p) => p.category === 'base'),
    savory: products.filter((p) => p.category === 'savory'),
    sweet: products.filter((p) => p.category === 'sweet'),
    /** Cracker flavors. Their price lives on the pack, not here. */
    crackers: products.filter((p) => p.category === 'cracker'),
  };
}
