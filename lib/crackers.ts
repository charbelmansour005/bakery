import 'server-only';
import { cache } from 'react';
import { isValidObjectId, type Types } from 'mongoose';
import dbConnect from './db';
import CrackerPack from '@/models/CrackerPack';
import type { CrackerPackDTO } from '@/types/cracker';
import type { z } from 'zod';
import type { crackerPackUpdateSchema } from './validation';

/** Cracker pack sizes. The flavors are ordinary products; see lib/products.ts. */

export type LeanPack = {
  _id: Types.ObjectId;
  name: string;
  grams: number;
  price: number;
  maxFlavors: number;
  sortOrder?: number;
};

export function toPackDTO(doc: LeanPack): CrackerPackDTO {
  return {
    id: doc._id.toString(),
    name: doc.name,
    grams: doc.grams,
    price: doc.price,
    maxFlavors: doc.maxFlavors,
    sortOrder: doc.sortOrder ?? 0,
  };
}

/** Wrapped in React `cache` so one render hits Mongo once. */
export const getCrackerPacks = cache(async (): Promise<CrackerPackDTO[]> => {
  await dbConnect();
  const docs = await CrackerPack.find({}).sort({ sortOrder: 1, grams: 1 }).lean<LeanPack[]>();
  return docs.map(toPackDTO);
});

export async function packsById(ids: string[]): Promise<Map<string, LeanPack>> {
  const valid = ids.filter((id) => isValidObjectId(id));
  if (valid.length === 0) return new Map();
  await dbConnect();
  const docs = await CrackerPack.find({ _id: { $in: valid } }).lean<LeanPack[]>();
  return new Map(docs.map((doc) => [doc._id.toString(), doc]));
}

export async function updateCrackerPack(
  id: string,
  input: z.infer<typeof crackerPackUpdateSchema>,
): Promise<CrackerPackDTO | null> {
  if (!isValidObjectId(id)) return null;
  await dbConnect();
  const doc = await CrackerPack.findByIdAndUpdate(id, input, { new: true, runValidators: true }).lean<LeanPack | null>();
  return doc ? toPackDTO(doc) : null;
}
