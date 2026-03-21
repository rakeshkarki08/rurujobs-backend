"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
require("dotenv/config");
const prisma = new client_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        yield prisma.application.deleteMany();
        yield prisma.job.deleteMany();
        yield prisma.user.deleteMany();
        const admin = yield prisma.user.create({
            data: { name: 'Admin User', email: 'admin@rurujobs.com', role: client_1.Role.ADMIN },
        });
        const employer = yield prisma.user.create({
            data: { name: 'Tech Corp', email: 'hr@techcorp.com', role: client_1.Role.EMPLOYER },
        });
        const seeker = yield prisma.user.create({
            data: { name: 'John Doe', email: 'john@example.com', role: client_1.Role.JOB_SEEKER },
        });
        const job1 = yield prisma.job.create({
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
        });
        const job2 = yield prisma.job.create({
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
        });
        yield prisma.application.create({
            data: {
                jobId: job1.id,
                userId: seeker.id,
                cvUrl: 'https://res.cloudinary.com/dpkbxdvhm/image/upload/v1/mock_cv.pdf',
                status: 'PENDING',
            },
        });
        console.log('Seeding finished.');
    });
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(() => __awaiter(void 0, void 0, void 0, function* () {
    yield prisma.$disconnect();
}));
