import { Prisma, PrismaClient, type OrderStatus } from '@prisma/client';

const prisma = new PrismaClient();

const catalog: Array<[string, string, string]> = [
  ['MILK-1L', 'Whole Milk 1L', '68.00'],
  ['BREAD-WHT', 'White Bread', '45.00'],
  ['EGGS-6', 'Farm Eggs 6 Pack', '92.00'],
  ['RICE-1KG', 'Basmati Rice 1kg', '145.00'],
  ['ATTA-1KG', 'Wheat Atta 1kg', '58.00'],
  ['DAL-500', 'Toor Dal 500g', '86.00'],
  ['OIL-1L', 'Sunflower Oil 1L', '168.00'],
  ['SUGAR-1KG', 'Sugar 1kg', '52.00'],
  ['SALT-1KG', 'Iodised Salt 1kg', '24.00'],
  ['TEA-250', 'Assam Tea 250g', '175.00'],
  ['COFFEE-100', 'Filter Coffee 100g', '210.00'],
  ['BANANA-6', 'Bananas 6 Pack', '48.00'],
  ['APPLE-4', 'Apples 4 Pack', '120.00'],
  ['TOMATO-500', 'Tomatoes 500g', '36.00'],
  ['ONION-1KG', 'Onions 1kg', '42.00'],
  ['POTATO-1KG', 'Potatoes 1kg', '38.00'],
  ['SPINACH', 'Spinach Bunch', '28.00'],
  ['CORIANDER', 'Coriander Bunch', '18.00'],
  ['YOGURT-400', 'Plain Yogurt 400g', '55.00'],
  ['PANEER-200', 'Paneer 200g', '98.00'],
  ['BUTTER-100', 'Butter 100g', '62.00'],
  ['CHEESE-200', 'Cheddar Cheese 200g', '155.00'],
  ['CHICKEN-500', 'Chicken Curry Cut 500g', '189.00'],
  ['FISH-400', 'Rohu Fish 400g', '230.00'],
  ['TOFU-200', 'Firm Tofu 200g', '75.00'],
  ['PASTA-500', 'Penne Pasta 500g', '89.00'],
  ['NOODLES-4', 'Instant Noodles 4 Pack', '72.00'],
  ['OATS-500', 'Rolled Oats 500g', '115.00'],
  ['HONEY-250', 'Honey 250g', '165.00'],
  ['JAM-200', 'Mixed Fruit Jam 200g', '95.00'],
  ['BISCUIT-TEA', 'Tea Biscuits', '30.00'],
  ['CHIPS-SALT', 'Salted Chips', '20.00'],
  ['JUICE-1L', 'Orange Juice 1L', '125.00'],
  ['WATER-1L', 'Mineral Water 1L', '20.00'],
  ['SODA-750', 'Sparkling Water 750ml', '45.00'],
  ['SOAP-3', 'Bath Soap 3 Pack', '99.00'],
  ['SHAMPOO-180', 'Shampoo 180ml', '149.00'],
  ['TOOTHPASTE', 'Toothpaste 150g', '88.00'],
  ['DETERGENT-1', 'Detergent 1kg', '132.00'],
  ['TISSUE-4', 'Tissue 4 Pack', '76.00'],
  ['FLOUR-500', 'Maida 500g', '34.00'],
  ['BESAN-500', 'Besan 500g', '64.00'],
  ['POHA-500', 'Poha 500g', '48.00'],
  ['SEMOLINA-500', 'Rava 500g', '46.00'],
  ['GINGER-200', 'Ginger 200g', '32.00'],
  ['GARLIC-200', 'Garlic 200g', '40.00'],
  ['CHILLI-100', 'Green Chilli 100g', '22.00'],
  ['LEMON-4', 'Lemons 4 Pack', '26.00'],
  ['CURD-1KG', 'Curd 1kg', '78.00'],
  ['GHEE-200', 'Ghee 200ml', '210.00'],
];

const customers = [
  'Asha Menon',
  'Rahul Iyer',
  'Neha Kapoor',
  'Vikram Shah',
  'Priya Nair',
  'Arjun Das',
  'Meera Joshi',
  'Karan Patel',
  'Sana Qureshi',
  'Dev Krishnan',
];

function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, values: T[]): T {
  const index = Math.floor(rng() * values.length);
  return values[index] ?? values[0]!;
}

function intBetween(rng: () => number, min: number, max: number) {
  return min + Math.floor(rng() * (max - min + 1));
}

async function main() {
  const force = process.argv.includes('--force') || process.env.SEED_FORCE === 'true';
  const existingStores = await prisma.store.count();
  if (existingStores > 0 && !force) {
    console.log('Seed skipped because stores already exist. Run npm run db:seed:fresh to reset.');
    return;
  }

  await prisma.idempotencyKey.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.store.deleteMany();

  const stores = await Promise.all([
    prisma.store.create({ data: { name: 'Gigabox Central', address: '12 Market Street' } }),
    prisma.store.create({ data: { name: 'Gigabox Riverside', address: '88 Harbor Road' } }),
  ]);

  const products = await Promise.all(
    catalog.map(([sku, name, price]) =>
      prisma.product.create({
        data: { sku, name, price: new Prisma.Decimal(price), description: `${name} for 60-minute delivery.` },
      }),
    ),
  );

  const lowOpeningStock = [2, 0, 4, 8, 3, 6];
  for (const store of stores) {
    await prisma.inventory.createMany({
      data: products.map((product, index) => ({
        storeId: store.id,
        productId: product.id,
        stock: index < lowOpeningStock.length ? lowOpeningStock[index]! : 120,
        lowStockThreshold: 10,
      })),
    });
  }

  const rng = mulberry32(20261005);
  const statuses: OrderStatus[] = [
    ...Array.from({ length: 40 }, () => 'PLACED' as const),
    ...Array.from({ length: 30 }, () => 'PACKED' as const),
    ...Array.from({ length: 20 }, () => 'OUT_FOR_DELIVERY' as const),
    ...Array.from({ length: 80 }, () => 'DELIVERED' as const),
    ...Array.from({ length: 30 }, () => 'CANCELLED' as const),
  ];

  for (let index = statuses.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    const current = statuses[index]!;
    statuses[index] = statuses[swap]!;
    statuses[swap] = current;
  }

  const now = Date.now();
  for (const status of statuses) {
    const store = pick(rng, stores);
    const open = status === 'PLACED' || status === 'PACKED' || status === 'OUT_FOR_DELIVERY';
    const pool = open ? products.slice(6) : products;
    const itemCount = intBetween(rng, 1, 3);
    const chosen = new Set<string>();
    const items: { productId: string; quantity: number; unitPrice: Prisma.Decimal }[] = [];
    let attempts = 0;

    while (items.length < itemCount && attempts < 20) {
      attempts += 1;
      const product = pick(rng, pool);
      if (chosen.has(product.id)) continue;
      const quantity = intBetween(rng, 1, 2);
      if (open) {
        const updated = await prisma.inventory.updateMany({
          where: { storeId: store.id, productId: product.id, stock: { gte: quantity } },
          data: { stock: { decrement: quantity } },
        });
        if (updated.count !== 1) continue;
      }
      chosen.add(product.id);
      items.push({ productId: product.id, quantity, unitPrice: product.price });
    }

    if (items.length === 0) continue;

    const createdAt = new Date(now - intBetween(rng, 30, 14 * 24 * 60) * 60 * 1000);
    const packedAt = status === 'PLACED' || status === 'CANCELLED' ? null : new Date(createdAt.getTime() + 12 * 60 * 1000);
    const outForDeliveryAt =
      status === 'OUT_FOR_DELIVERY' || status === 'DELIVERED'
        ? new Date(createdAt.getTime() + 28 * 60 * 1000)
        : null;
    const deliveredAt = status === 'DELIVERED' ? new Date(createdAt.getTime() + 52 * 60 * 1000) : null;
    const cancelledAt = status === 'CANCELLED' ? new Date(createdAt.getTime() + 18 * 60 * 1000) : null;
    const total = items.reduce((sum, item) => sum.plus(item.unitPrice.mul(item.quantity)), new Prisma.Decimal(0));

    await prisma.order.create({
      data: {
        storeId: store.id,
        status,
        customerName: pick(rng, customers),
        totalAmount: total,
        createdAt,
        packedAt,
        outForDeliveryAt,
        deliveredAt,
        cancelledAt,
        items: { create: items },
      },
    });
  }

  const [storeCount, productCount, inventoryCount, orderCount] = await Promise.all([
    prisma.store.count(),
    prisma.product.count(),
    prisma.inventory.count(),
    prisma.order.count(),
  ]);
  console.log(`Seeded ${storeCount} stores, ${productCount} products, ${inventoryCount} inventory rows, ${orderCount} orders.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
