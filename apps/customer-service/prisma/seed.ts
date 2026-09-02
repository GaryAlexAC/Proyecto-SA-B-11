import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const requiredVariables = [
  'DATABASE_URL',
  'INITIAL_ADMIN_FULL_NAME',
  'INITIAL_ADMIN_DOCUMENT',
  'INITIAL_ADMIN_EMAIL',
  'INITIAL_ADMIN_BIRTH_DATE',
  'INITIAL_ADMIN_ADDRESS',
  'INITIAL_ADMIN_PASSWORD',
] as const;

for (const variable of requiredVariables) {
  if (!process.env[variable]?.trim()) throw new Error(`${variable} es obligatoria para crear el administrador inicial`);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function seed(): Promise<void> {
  const email = process.env.INITIAL_ADMIN_EMAIL!.trim().toLowerCase();
  const document = process.env.INITIAL_ADMIN_DOCUMENT!.trim().toUpperCase();
  const fullName = process.env.INITIAL_ADMIN_FULL_NAME!.trim();
  const address = process.env.INITIAL_ADMIN_ADDRESS!.trim();
  const password = process.env.INITIAL_ADMIN_PASSWORD!;
  const birthDate = new Date(process.env.INITIAL_ADMIN_BIRTH_DATE!);
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('INITIAL_ADMIN_EMAIL no es válido');
  if (Number.isNaN(birthDate.getTime()) || birthDate > new Date()) throw new Error('INITIAL_ADMIN_BIRTH_DATE no es válida');
  if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) throw new Error('INITIAL_ADMIN_PASSWORD no cumple la política mínima');
  if (Buffer.byteLength(password, 'utf8') > 72) throw new Error('INITIAL_ADMIN_PASSWORD no puede superar 72 bytes');

  const existingAdmin = await prisma.customer.findUnique({ where: { username: 'admin' } });
  if (existingAdmin) {
    if (existingAdmin.role === 'ADMIN') return;
    throw new Error('El username reservado admin pertenece a un usuario sin rol ADMIN');
  }
  const conflictingIdentity = await prisma.customer.findFirst({ where: { OR: [{ email }, { document }] } });
  if (conflictingIdentity) throw new Error('El correo o documento del administrador inicial pertenece a otro usuario');

  await prisma.customer.create({
    data: {
      fullName,
      document,
      email,
      birthDate,
      address,
      username: 'admin',
      passwordHash: await bcrypt.hash(password, 12),
      role: 'ADMIN',
      status: 'ACTIVE',
      activatedAt: new Date(),
    },
  });
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
