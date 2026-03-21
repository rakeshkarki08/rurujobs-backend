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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const prisma = new client_1.PrismaClient();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Register
app.post('/api/auth/register', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, email, password, role } = req.body;
        const existingUser = yield prisma.user.findUnique({ where: { email } });
        if (existingUser)
            return res.status(400).json({ error: 'Email already exists' });
        const hashedPassword = yield bcryptjs_1.default.hash(password, 10);
        const userRole = role === 'EMPLOYER' ? client_1.Role.EMPLOYER : client_1.Role.JOB_SEEKER;
        const user = yield prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: userRole
            }
        });
        const token = jsonwebtoken_1.default.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
        res.status(201).json({ user, token });
    }
    catch (error) {
        res.status(500).json({ error: 'Registration failed' });
    }
}));
// Login
app.post('/api/auth/login', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password } = req.body;
        const user = yield prisma.user.findUnique({ where: { email } });
        if (!user || !user.password)
            return res.status(400).json({ error: 'Invalid credentials' });
        const valid = yield bcryptjs_1.default.compare(password, user.password);
        if (!valid)
            return res.status(400).json({ error: 'Invalid credentials' });
        const token = jsonwebtoken_1.default.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
        res.json({ user, token });
    }
    catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
}));
// Employee Profile Onboarding
app.post('/api/profiles/employee', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const data = req.body;
        const { userId } = data, profileData = __rest(data, ["userId"]);
        const profile = yield prisma.employeeProfile.upsert({
            where: { userId },
            update: profileData,
            create: Object.assign({ userId }, profileData),
        });
        res.json(profile);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Profile creation failed' });
    }
}));
// Employer Profile Onboarding
app.post('/api/profiles/employer', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const data = req.body;
        const { userId, startDate } = data, profileData = __rest(data, ["userId", "startDate"]);
        // Convert startDate to DateTime if provided
        const parsedStartDate = startDate ? new Date(startDate) : new Date();
        const profile = yield prisma.employerProfile.upsert({
            where: { userId },
            update: Object.assign(Object.assign({}, profileData), { startDate: parsedStartDate }),
            create: Object.assign({ userId, startDate: parsedStartDate }, profileData),
        });
        res.json(profile);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Profile creation failed' });
    }
}));
// Get all jobs
app.get('/api/jobs', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const jobs = yield prisma.job.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                employer: { select: { name: true } },
                _count: { select: { applications: true } }
            }
        });
        res.json(jobs);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch jobs' });
    }
}));
// Create a job
app.post('/api/jobs', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const data = req.body;
        const employer = yield prisma.user.findFirst({
            where: { role: client_1.Role.EMPLOYER }
        });
        const job = yield prisma.job.create({
            data: {
                title: data.title,
                company: data.company,
                location: data.location,
                salary: data.salary,
                type: data.type,
                category: data.category,
                description: data.description,
                employerId: (employer === null || employer === void 0 ? void 0 : employer.id) || null,
            }
        });
        res.status(201).json(job);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create job' });
    }
}));
// Delete a job
app.delete('/api/jobs/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        yield prisma.application.deleteMany({ where: { jobId: id } });
        yield prisma.job.delete({ where: { id } });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete job' });
    }
}));
// Get all users
app.get('/api/users', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const users = yield prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: { select: { jobsPosted: true, applications: true } }
            }
        });
        res.json(users);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
}));
// Delete a user
app.delete('/api/users/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        yield prisma.application.deleteMany({ where: { userId: id } });
        yield prisma.job.deleteMany({ where: { employerId: id } });
        yield prisma.user.delete({ where: { id } });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
}));
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
