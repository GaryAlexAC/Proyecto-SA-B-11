import {
  PrismaClient,
  CustomerRole,
  CustomerStatus,
} from '../src/generated/prisma/index.js';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_USERNAME ?? 'admin';
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    throw new Error('ADMIN_PASSWORD is required to seed the initial administrator');
  }

  await prisma.customer.upsert({
    where: { username },
    update: {},
    create: {
      fullName: process.env.ADMIN_NAME ?? 'Bank USAC Admin',
      document: process.env.ADMIN_DOCUMENT ?? 'ADMIN-001',
      email: (process.env.ADMIN_EMAIL ?? 'admin@bankusac.local').toLowerCase(),
      birthDate: new Date(process.env.ADMIN_BIRTH_DATE ?? '1990-01-01'),
      address: process.env.ADMIN_ADDRESS ?? 'Bank USAC',
      username,
      passwordHash: await hash(password, 12),
      role: CustomerRole.ADMIN,
      status: CustomerStatus.ACTIVE,
      activatedAt: new Date(),
    },
  });
}

main()
  .finally(async () => prisma.$disconnect());
