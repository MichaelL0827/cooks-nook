import { PrismaClient } from "@prisma/client";

// Reuse a single PrismaClient instance across the app instead of creating
// a new one per request (each instance opens its own connection pool).
const prisma = new PrismaClient();

export default prisma;
