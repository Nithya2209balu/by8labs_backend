const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { protect } = require('../middleware/auth');
const StudentAttendance = require('../models/StudentAttendance');
const Student = require('../models/Student');

const hrOnly = (req, res, next) => {
    if (req.user.role !== 'HR') return res.status(403).json({ message: 'Access denied. HR only.' });
    next();
};

// GET attendance records (with filters)
router.get('/', protect, hrOnly, async (req, res) => {
    try {
        const { date, course, student, startDate, endDate } = req.query;
        const query = {};
        if (student) query.student = student;
        if (course) query.course = course;
        if (date) query.date = new Date(date);
        if (startDate && endDate) {
            query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }
        const records = await StudentAttendance.find(query)
            .populate('student', 'name studentId')
            .populate('course', 'courseName courseCode')
            .sort({ date: -1 });
        res.json(records);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// POST mark attendance (bulk for a date)
router.post('/bulk', protect, hrOnly, async (req, res) => {
    try {
        const { date, course, records } = req.body;
        // records: [{ student, status, notes }]
        const ops = records.map(r => ({
            updateOne: {
                filter: { student: r.student, date: new Date(date) },
                update: { $set: { status: r.status, course, notes: r.notes, markedBy: req.user._id } },
                upsert: true,
            },
        }));
        await StudentAttendance.bulkWrite(ops);
        res.json({ message: 'Attendance marked successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// POST mark single attendance
router.post('/', protect, hrOnly, async (req, res) => {
    try {
        const { student, date, status, course, notes } = req.body;
        const record = await StudentAttendance.findOneAndUpdate(
            { student, date: new Date(date) },
            { status, course, notes, markedBy: req.user._id },
            { upsert: true, new: true }
        ).populate('student', 'name studentId');
        res.json(record);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// PUT edit attendance record
router.put('/:id', protect, hrOnly, async (req, res) => {
    try {
        const record = await StudentAttendance.findByIdAndUpdate(
            req.params.id,
            { ...req.body, markedBy: req.user._id },
            { new: true }
        ).populate('student', 'name studentId').populate('course', 'courseName');
        if (!record) return res.status(404).json({ message: 'Record not found' });
        res.json(record);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// GET attendance summary report
router.get('/report/summary', protect, hrOnly, async (req, res) => {
    try {
        const { startDate, endDate, course } = req.query;
        const matchStage = {};
        if (startDate && endDate) matchStage.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
        if (course) matchStage.course = new mongoose.Types.ObjectId(course);

        const summary = await StudentAttendance.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$student',
                    total: { $sum: 1 },
                    present: { $sum: { $cond: [{ $eq: ['$status', 'Present'] }, 1, 0] } },
                    absent: { $sum: { $cond: [{ $eq: ['$status', 'Absent'] }, 1, 0] } },
                    late: { $sum: { $cond: [{ $eq: ['$status', 'Late'] }, 1, 0] } },
                },
            },
            {
                $lookup: {
                    from: 'students',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'studentInfo',
                },
            },
            { $unwind: '$studentInfo' },
            {
                $project: {
                    name: '$studentInfo.name',
                    studentId: '$studentInfo.studentId',
                    total: 1,
                    present: 1,
                    absent: 1,
                    late: 1,
                    percentage: { $multiply: [{ $divide: ['$present', { $max: ['$total', 1] }] }, 100] },
                },
            },
            { $sort: { name: 1 } },
        ]);
        res.json(summary);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router;
