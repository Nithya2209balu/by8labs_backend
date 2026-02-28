const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { isHR } = require('../middleware/rbac');
const Employee = require('../models/Employee');
const { Leave } = require('../models/Leave');
const Attendance = require('../models/Attendance');

// @route   GET /api/dashboard/stats
// @desc    Get dashboard statistics
// @access  Private
router.get('/stats', protect, async (req, res) => {
    try {
        const stats = {};

        // Total Employees
        const totalEmployees = await Employee.countDocuments({ isActive: true });
        stats.totalEmployees = totalEmployees;

        // Pending Leaves (only for HR/Manager)
        if (req.user.role === 'HR' || req.user.role === 'Manager') {
            const pendingLeaves = await Leave.countDocuments({ status: 'Pending' });
            stats.pendingLeaves = pendingLeaves;
        } else {
            stats.pendingLeaves = 0;
        }

        // Attendance Rate (for current month)
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const workingDays = endOfMonth.getDate();

        const totalAttendance = await Attendance.countDocuments({
            date: { $gte: startOfMonth, $lte: endOfMonth },
            status: { $in: ['Present', 'Work From Home'] }
        });

        const expectedAttendance = totalEmployees * workingDays;
        const attendanceRate = expectedAttendance > 0
            ? ((totalAttendance / expectedAttendance) * 100).toFixed(1)
            : 0;

        stats.attendanceRate = attendanceRate;

        // Monthly Payroll (placeholder - will be real when payroll is processed)
        stats.monthlyPayroll = '0';

        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
