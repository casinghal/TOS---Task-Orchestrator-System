import { PrismaClient } from "@prisma/client";

declare global {
  var __tos_prisma__: PrismaClient | undefined;
}

const globalForPrisma = globalThis as typeof globalThis & {
  __tos_prisma__?: PrismaClient;
};

export const prisma = globalForPrisma.__tos_prisma__ ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__tos_prisma__ = prisma;
}
