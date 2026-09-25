import { PrismaClient } from '@prisma/client-payment';

const prisma = new PrismaClient();

const serviceOfferings = [
  { companyName: 'Tigo', serviceName: 'Telefonia movil', amount: 100 },
  { companyName: 'EEGSA', serviceName: 'Energia electrica', amount: 250 },
  { companyName: 'EMPAGUA', serviceName: 'Agua potable', amount: 75 },
  { companyName: 'Claro', serviceName: 'Internet residencial', amount: 300 },
];

async function main() {
  for (const offering of serviceOfferings) {
    const company = await prisma.company.upsert({
      where: { name: offering.companyName },
      update: {},
      create: { name: offering.companyName },
    });

    await prisma.service.upsert({
      where: {
        companyId_name: {
          companyId: company.id,
          name: offering.serviceName,
        },
      },
      update: {},
      create: {
        companyId: company.id,
        name: offering.serviceName,
        amount: offering.amount,
      },
    });
  }
}

main().finally(async () => prisma.$disconnect());

