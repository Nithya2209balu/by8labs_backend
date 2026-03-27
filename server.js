// Server v2 - reloaded
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased for video uploads
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static folder for uploads
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/leaves', require('./routes/leaves'));
app.use('/api/payroll', require('./routes/payroll'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/access-requests', require('./routes/accessRequests'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/holidays', require('./routes/holidays'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/emails', require('./routes/emails'));
app.use('/api/email-config', require('./routes/emailConfig'));
app.use('/api', require('./routes/testImap')); // Test route for IMAP diagnostics

// Recruitment module routes
app.use('/api/recruitment/jobs', require('./routes/recruitment-jobs'));
app.use('/api/recruitment/candidates', require('./routes/recruitment-candidates'));
app.use('/api/recruitment/interviews', require('./routes/recruitment-interviews'));
app.use('/api/recruitment/offers', require('./routes/recruitment-offers'));

// Reports module routes
app.use('/api/reports', require('./routes/reports'));

// Performance module routes
app.use('/api/performance', require('./routes/performance'));

// Document management routes
app.use('/api/documents', require('./routes/documents'));

// Student module routes (HR only)
app.use('/api/students', require('./routes/students'));
app.use('/api/student-courses', require('./routes/studentCourses'));
app.use('/api/attendance', require('./routes/attendance')); // Employee
app.use('/api/attendance', require('./routes/studentAttendance')); // Student-ID based & shared
app.use('/api/student-attendance', require('./routes/studentAttendance')); // Legacy/specific
app.use('/api/student-fees', require('./routes/studentFees'));
app.use('/api/student-leaves', require('./routes/studentLeaves'));
app.use('/api/student-assignments', require('./routes/studentAssignments'));
app.use('/api/student-reports', require('./routes/studentReports'));
app.use('/api/student-admissions', require('./routes/studentAdmissions'));
app.use('/api/courses', require('./routes/courses'));

// Welcome route
app.get('/', (req, res) => {
    res.json({ message: 'BY8labs API' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

