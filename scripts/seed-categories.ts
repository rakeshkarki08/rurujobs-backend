import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const nannyCategory = await prisma.jobCategory.upsert({
    where: { name: 'Nannies' },
    update: {},
    create: {
      name: 'Nannies',
      description: 'Find trusted nannies and childcare providers for your family.',
      imageUrl: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&h=600&fit=crop&q=80',
    },
  });

  console.log('Seeded Nannies category:', nannyCategory);

  // Add others as mentioned
  const driverCategory = await prisma.jobCategory.upsert({
    where: { name: 'Drivers' },
    update: {},
    create: {
      name: 'Drivers',
      description: 'Reliable drivers for personal and business needs.',
      imageUrl: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800&h=600&fit=crop&q=80',
    },
  });

  const restaurantCategory = await prisma.jobCategory.upsert({
    where: { name: 'Restaurant Workers' },
    update: {},
    create: {
      name: 'Restaurant Workers',
      description: 'Opportunities in the hospitality and food service industry.',
      imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop&q=80',
    },
  });

  console.log('Seeded Other categories');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
