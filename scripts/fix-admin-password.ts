import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@rurujobs.com';
  const password = 'admin123';
  const hashedPassword = await bcrypt.hash(password, 10);

  console.log(`Setting password for ${email}...`);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      role: Role.ADMIN,
      name: 'Admin User'
    },
    create: {
      email,
      password: hashedPassword,
      role: Role.ADMIN,
      name: 'Admin User'
    }
  });

  console.log('Admin user updated/created:', user.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
