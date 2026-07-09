import { PrismaClient } from '@prisma/client';

// Standard Next.js singleton pattern so hot-reload in dev doesn't
// spawn a new PrismaClient (and a new DB connection pool) every save.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
