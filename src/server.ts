import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// Root route for health check
app.get('/', (req, res) => {
  res.json({ message: 'RuruJobs API is running', status: 'OK' });
});

// API base route
app.get('/api', (req, res) => {
  res.json({ message: 'Welcome to RuruJobs API v1' });
});

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ error: 'Email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const userRole = role === 'EMPLOYER' ? Role.EMPLOYER : Role.JOB_SEEKER;

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: userRole
      }
    });

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
    res.status(201).json({ user, token });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) return res.status(400).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
    res.json({ user, token });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Employee Profile Onboarding
app.post('/api/profiles/employee', async (req, res) => {
  try {
    const data = req.body;
    const { userId, ...profileData } = data;
    const profile = await prisma.employeeProfile.upsert({
      where: { userId },
      update: profileData,
      create: { userId, ...profileData },
    });
    res.json(profile);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Profile creation failed' });
  }
});

// Employer Profile Onboarding
app.post('/api/profiles/employer', async (req, res) => {
  try {
    const data = req.body;
    const { userId, startDate, ...profileData } = data;
    // Convert startDate to DateTime if provided
    const parsedStartDate = startDate ? new Date(startDate) : new Date();
    const profile = await prisma.employerProfile.upsert({
      where: { userId },
      update: { ...profileData, startDate: parsedStartDate },
      create: { userId, startDate: parsedStartDate, ...profileData },
    });
    res.json(profile);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Profile creation failed' });
  }
});

// Get all jobs
app.get('/api/jobs', async (req, res) => {
  try {
    const jobs = await prisma.job.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        employer: { select: { name: true } },
        _count: { select: { applications: true } }
      }
    });
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// Create a job
app.post('/api/jobs', async (req, res) => {
  try {
    const data = req.body;
    const employer = await prisma.user.findFirst({
      where: { role: Role.EMPLOYER }
    });

    const job = await prisma.job.create({
      data: {
        title: data.title,
        company: data.company,
        location: data.location,
        salary: data.salary,
        type: data.type,
        category: data.category,
        description: data.description,
        employerId: employer?.id || null,
      }
    });
    res.status(201).json(job);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create job' });
  }
});

// Delete a job
app.delete('/api/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.application.deleteMany({ where: { jobId: id } });
    await prisma.job.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete job' });
  }
});

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { jobsPosted: true, applications: true } }
      }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Delete a user
app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.application.deleteMany({ where: { userId: id } });
    await prisma.job.deleteMany({ where: { employerId: id } });
    await prisma.user.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
