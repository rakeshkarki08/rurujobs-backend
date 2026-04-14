import { PrismaClient, Role } from '@prisma/client'
import 'dotenv/config'

const prisma = new PrismaClient()

async function main() {
  await prisma.application.deleteMany()
  await prisma.job.deleteMany()
  await prisma.user.deleteMany()

  const admin = await prisma.user.create({
    data: { name: 'Admin User', email: 'admin@rurujobs.com', role: Role.ADMIN },
  })
  
  const employer = await prisma.user.create({
    data: { name: 'Tech Corp', email: 'hr@techcorp.com', role: Role.EMPLOYER },
  })
  
  const seeker = await prisma.user.create({
    data: { name: 'John Doe', email: 'john@example.com', role: Role.JOB_SEEKER },
  })

  const job1 = await prisma.job.create({
    data: {
      title: 'Frontend Developer',
      company: 'Tech Corp',
      location: 'Kathmandu, Nepal',
      salary: '$60,000 - $80,000',
      type: 'Full-time',
      category: 'Engineering',
      description: 'Looking for a React and Next.js expert to join our team.',
      employerId: employer.id,
    },
  })

  const job2 = await prisma.job.create({
    data: {
      title: 'Marketing Manager',
      company: 'Global Solutions',
      location: 'Remote',
      salary: '$50,000 - $70,000',
      type: 'Remote',
      category: 'Marketing',
      description: 'Drive our digital marketing campaigns and strategy.',
      employerId: employer.id,
    },
  })

  await prisma.application.create({
    data: {
      jobId: job1.id,
      userId: seeker.id,
      fullName: 'John Doe',
      email: 'john@example.com',
      phoneNumber: '123-456-7890',
      cvUrl: 'https://res.cloudinary.com/dpkbxdvhm/image/upload/v1/mock_cv.pdf',
      status: 'PENDING',
    },
  })

  console.log('Seeding finished.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
