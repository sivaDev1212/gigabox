import { env } from '../config/env';

const KEY = 'products:list';
const TTL_SECONDS = 60;

type RedisClient = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', ttl: number): Promise<unknown>;
  del(key: string): Promise<unknown>;
};

let clientPromise: Promise<RedisClient | null> | null = null;

async function getClient(): Promise<RedisClient | null> {
  if (!env.REDIS_URL) return null;
  clientPromise ??= import('ioredis').then(({ default: Redis }) => new Redis(env.REDIS_URL));
  return clientPromise;
}

export async function readProductListCache<T>(): Promise<T | null> {
  try {
    const client = await getClient();
    if (!client) return null;
    const raw = await client.get(KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (error) {
    console.error('Product cache read failed', error);
    return null;
  }
}

export async function writeProductListCache(value: unknown): Promise<void> {
  try {
    const client = await getClient();
    if (!client) return;
    await client.set(KEY, JSON.stringify(value), 'EX', TTL_SECONDS);
  } catch (error) {
    console.error('Product cache write failed', error);
  }
}

export async function invalidateProductListCache(): Promise<void> {
  try {
    const client = await getClient();
    if (!client) return;
    await client.del(KEY);
  } catch (error) {
    console.error('Product cache invalidation failed', error);
  }
}
