import { hash } from 'bcryptjs';
import Admin from '../models/Admin';
import CrackerPack from '../models/CrackerPack';
import Product from '../models/Product';
import Story, { STORY_SINGLETON } from '../models/Story';
import { STORY_IMAGES } from './config';
import type { Category } from '../types/product';

/**
 * The starting catalogue, shared by `npm run seed` and the end-to-end tests'
 * own database. Expects mongoose to be connected already.
 *
 * Everything is inserted only if missing ($setOnInsert, matched by name): a
 * price, photo or description edited in the CMS is never overwritten, and an
 * item already on the menu is left exactly as it is. The one exception is the
 * admin password, which is reset to ADMIN_PASSWORD on purpose — that is how you
 * change it.
 */

type SeedProduct = {
  name: string;
  category: Category;
  description: string;
  /** integer cents */
  price: number;
  imageUrl: string;
  sortOrder: number;
};

export const SEED_PRODUCTS: SeedProduct[] = [
  { name: 'Classic',            category: 'base',   description: 'Naturally fermented • Hand shaped • Slow rested', price: 400, imageUrl: '/images/classic.jpg',            sortOrder: 1 },
  { name: 'Whole Wheat',        category: 'base',   description: 'Naturally fermented • Hand shaped • Slow rested', price: 500, imageUrl: '/images/whole-wheat.jpg',        sortOrder: 2 },
  { name: "Za'atar",            category: 'savory', description: 'Thyme, sesame & sumac',                           price: 150, imageUrl: '/images/zaatar.jpg',             sortOrder: 3 },
  { name: 'Olive',              category: 'savory', description: 'Green & kalamata olives',                         price: 250, imageUrl: '/images/olive.jpg',              sortOrder: 4 },
  { name: 'Multigrain',         category: 'savory', description: 'Sunflower, flax & sesame',                        price: 200, imageUrl: '/images/multigrain.jpg',         sortOrder: 5 },
  { name: 'Chocolate',          category: 'sweet',  description: 'Dark chocolate ribbons',                          price: 300, imageUrl: '/images/chocolate.jpg',          sortOrder: 6 },
  { name: 'Cinnamon',           category: 'sweet',  description: 'Brown sugar & cinnamon',                          price: 250, imageUrl: '/images/cinnamon.jpg',           sortOrder: 7 },
  { name: 'La Belle Signature', category: 'sweet',  description: 'Fig, Walnut & Raisin',                            price: 350, imageUrl: '/images/la-belle-signature.jpg', sortOrder: 8 },
];

/**
 * Cracker flavors. Priced by the pack, so `price` is 0. Their names can repeat
 * a loaf topping's (Za'atar, Multigrain) — they are matched on name *and*
 * category, so the two never collide.
 */
export const SEED_CRACKER_FLAVORS: SeedProduct[] = [
  ['Salt', 'salt'],
  ['Classic', 'classic'],
  ["Za'atar", 'zaatar'],
  ['Garlic & Thyme', 'garlic-thyme'],
  ['Smoky BBQ', 'smoky-bbq'],
  ['Pizza Herbs', 'pizza-herbs'],
  ['Onion & Oregano', 'onion-oregano'],
  ['Multigrain', 'multigrain'],
].map(([name, file], index) => ({
  name,
  category: 'cracker' as const,
  description: '',
  price: 0,
  imageUrl: `/images/crackers/${file}.jpg`,
  sortOrder: 100 + index,
}));

/**
 * Starting prices: the poster's 80,000 and 150,000 L.L. at about 89,500 to the
 * dollar, rounded. Starting points only — set the real ones at /admin/crackers.
 */
export const SEED_CRACKER_PACKS = [
  { name: 'Discovery Pack', grams: 50, price: 90, maxFlavors: 2, sortOrder: 1 },
  { name: 'Sharing Pack', grams: 100, price: 170, maxFlavors: 4, sortOrder: 2 },
];

export type SeedReport = { productsAdded: number; packsAdded: number; storyAdded: boolean; admin: string | null };

export async function seedCatalogue(options: { adminUsername?: string; adminPassword?: string } = {}): Promise<SeedReport> {
  const products = [...SEED_PRODUCTS, ...SEED_CRACKER_FLAVORS];
  const productResult = await Product.bulkWrite(
    products.map((product) => ({
      updateOne: {
        filter: { name: product.name, category: product.category },
        update: { $setOnInsert: product },
        upsert: true,
      },
    })),
  );

  const packResult = await CrackerPack.bulkWrite(
    SEED_CRACKER_PACKS.map((pack) => ({
      updateOne: { filter: { name: pack.name }, update: { $setOnInsert: pack }, upsert: true },
    })),
  );

  const story = await Story.updateOne(
    { singleton: STORY_SINGLETON },
    {
      $setOnInsert: {
        singleton: STORY_SINGLETON,
        primary: { url: STORY_IMAGES.primary.src, alt: STORY_IMAGES.primary.alt },
        secondary: { url: STORY_IMAGES.secondary.src, alt: STORY_IMAGES.secondary.alt },
      },
    },
    { upsert: true },
  );

  let admin: string | null = null;
  if (options.adminUsername && options.adminPassword) {
    const passwordHash = await hash(options.adminPassword, 10);
    await Admin.updateOne(
      { username: options.adminUsername },
      { $set: { username: options.adminUsername, passwordHash } },
      { upsert: true },
    );
    admin = options.adminUsername;
  }

  return {
    productsAdded: productResult.upsertedCount,
    packsAdded: packResult.upsertedCount,
    storyAdded: story.upsertedCount > 0,
    admin,
  };
}
