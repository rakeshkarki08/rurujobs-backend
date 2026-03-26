import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

dotenv.config();

cloudinary.config();

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let resource_type = 'auto';
    if (file.mimetype.includes('pdf') || file.mimetype.includes('document') || file.mimetype.includes('msword') || file.originalname.endsWith('.docx')) {
      resource_type = 'raw';
    } else if (file.mimetype.includes('image')) {
      resource_type = 'image';
    }
    return {
      folder: 'rurujobs_uploads',
      resource_type: resource_type,
    };
  },
});

const upload = multer({ storage: storage });

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// File Upload endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({ url: req.file.path });
});

// Root route for health check
app.get('/', (req, res) => {
  res.json({ message: 'RuruJobs API is running', status: 'OK' });
});

// API base route
app.get('/api', (req, res) => {
  res.json({ message: 'Welcome to RuruJobs API v1' });
});

// Auth Middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied' });

  jwt.verify(token, process.env.JWT_SECRET || 'secret', (err: any, user: any) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Get Current User Profile
app.get('/api/profiles/me', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        employeeProfile: true,
        employerProfile: true
      }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
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

// --- Admin Verification Endpoints ---

// Get profiles by status
app.get('/api/admin/profiles/:status', async (req: any, res: any) => {
  try {
    const { status } = req.params;
    const upperStatus = status.toUpperCase();

    if (!['PENDING', 'APPROVED', 'REJECTED'].includes(upperStatus)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const employees = await prisma.employeeProfile.findMany({
      where: { status: upperStatus },
      include: { user: { select: { name: true, email: true } } }
    });
    
    const employers = await prisma.employerProfile.findMany({
      where: { status: upperStatus },
      include: { user: { select: { name: true, email: true } } }
    });

    res.json({ employees, employers });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch profiles' });
  }
});

// Update profile status
app.put('/api/admin/profiles/:type/:id/status', async (req: any, res: any) => {
  try {
    const { type, id } = req.params;
    const { status } = req.body; // 'APPROVED' or 'REJECTED'

    if (type === 'employee') {
      const updated = await prisma.employeeProfile.update({
        where: { id },
        data: { status }
      });
      return res.json(updated);
    } else if (type === 'employer') {
      const updated = await prisma.employerProfile.update({
        where: { id },
        data: { status }
      });
      return res.json(updated);
    } else {
      return res.status(400).json({ error: 'Invalid profile type' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update profile status' });
  }
});

// Get all approved talents (public directory)
app.get('/api/talents', async (req: any, res: any) => {
  try {
    const talents = await prisma.employeeProfile.findMany({
      where: { status: 'APPROVED' },
    });
    
    // Mask sensitive info for public viewing
    const maskedTalents = talents.map((t: any) => ({
      ...t,
      firstName: t.firstName ? t.firstName[0] + '****' : '****',
      lastName: t.lastName ? t.lastName[0] + '****' : '****',
      phone: '***-***-****',
      user: undefined, // ensure no user email or password leaks
    }));

    res.json(maskedTalents);
  } catch (error) {
    console.error('Fetch talents error:', error);
    res.status(500).json({ error: 'Server error' });
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

// Job Categories
app.get('/api/job-categories', async (req, res) => {
  try {
    const categories = await prisma.jobCategory.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { jobs: true }
        }
      }
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

app.post('/api/job-categories', async (req, res) => {
  try {
    const { name, description, imageUrl } = req.body;
    const category = await prisma.jobCategory.create({
      data: { name, description, imageUrl }
    });
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create category' });
  }
});

app.put('/api/job-categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, imageUrl } = req.body;
    const category = await prisma.jobCategory.update({
      where: { id },
      data: { name, description, imageUrl }
    });
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// Get all jobs
app.get('/api/jobs', async (req, res) => {
  try {
    // We remove the strict where clause that hides admin-created jobs without approved employers.
    // Instead we just get all jobs to display in /jobs.
    const jobs = await prisma.job.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        employer: { select: { name: true } },
        jobCategory: true,
        _count: { select: { applications: true } }
      }
    });
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// Create a job
app.post('/api/jobs', authenticateToken, async (req: any, res: any) => {
  try {
    const data = req.body;
    const userRole = req.user.role;

    if (userRole !== Role.ADMIN) {
      return res.status(403).json({ error: 'Only admins can post jobs' });
    }

    let employerId = data.employerId || null;
    if (!employerId) {
      const employer = await prisma.user.findFirst({
        where: { role: Role.EMPLOYER }
      });
      employerId = employer?.id || null;
    }

    const job = await prisma.job.create({
      data: {
        title: data.title,
        company: data.company,
        location: data.location,
        salary: data.salary,
        type: data.type,
        category: data.category || '', // fallback
        categoryId: data.categoryId || null,
        description: data.description,
        workDays: data.workDays,
        liveInOut: data.liveInOut,
        languageReq: data.languageReq,
        nationalityPrefer: data.nationalityPrefer,
        employerId: employerId,
      }
    });
    res.status(201).json(job);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create job' });
  }
});

// Get a single job
app.get('/api/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        employer: { 
          include: { employerProfile: true } 
        },
        jobCategory: true,
        _count: { select: { applications: true } }
      }
    });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

// Update a job
app.put('/api/jobs/:id', authenticateToken, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const userRole = req.user.role;

    if (userRole !== Role.ADMIN) {
      return res.status(403).json({ error: 'Only admins can update jobs' });
    }

    const job = await prisma.job.update({
      where: { id },
      data: {
        title: data.title,
        company: data.company,
        location: data.location,
        salary: data.salary,
        type: data.type,
        category: data.category || '',
        categoryId: data.categoryId || null,
        description: data.description,
        workDays: data.workDays,
        liveInOut: data.liveInOut,
        languageReq: data.languageReq,
        nationalityPrefer: data.nationalityPrefer,
      }
    });
    res.json(job);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update job' });
  }
});

// Delete a job
app.delete('/api/jobs/:id', authenticateToken, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const userRole = req.user.role;

    if (userRole !== Role.ADMIN) {
      return res.status(403).json({ error: 'Only admins can delete jobs' });
    }

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
