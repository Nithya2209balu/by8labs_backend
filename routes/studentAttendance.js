const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { protect } = require('../middleware/auth');
const StudentAttendance = require('../models/StudentAttendance');

const hrOnly = (req, res, next) => {
    if (req.user.role !== 'HR') return res.status(403).json({ message: 'Access denied. HR only.' });
    next();
};

// Helper: UTC date range for a given date string (e.g., '2026-03-02')
const dayStart = (d) => new Date(d + 'T00:00:00.000Z');
const dayEnd   = (d) => new Date(d + 'T23:59:59.999Z');

// ─── GET all attendance records (with filters) ─────────────────────────────
router.get('/', protect, hrOnly, async (req, res) => {
    try {
        const { date, course, student, startDate, endDate } = req.query;
        const query = {};
        if (student) query.student = new mongoose.Types.ObjectId(student);
        if (course)  query.course  = new mongoose.Types.ObjectId(course);
        if (date) {
            query.date = { $gte: dayStart(date), $lte: dayEnd(date) };
        } else if (startDate && endDate) {
            query.date = { $gte: dayStart(startDate), $lte: dayEnd(endDate) };
        }
        const records = await StudentAttendance.find(query)
            .populate('student', 'name studentId')
            .populate('course', 'courseName courseCode')
            .sort({ date: -1 });
        res.json(records);
    } catch (err) {
        console.error('GET attendance error:', err.message);
        res.status(500).json({ message: err.message });
    }
});

// ─── POST /bulk — save attendance for a date ───────────────────────────────
router.post('/bulk', protect, hrOnly, async (req, res) => {
    try {
        const { date, course, records } = req.body;
        if (!date || !Array.isArray(records) || records.length === 0) {
            return res.status(400).json({ message: 'date and records are required' });
        }

        const storedDate = dayStart(date);                              // UTC midnight
        const courseId   = course ? new mongoose.Types.ObjectId(course) : null;
        const savedBy    = req.user._id;

        let saved = 0;
        for (const r of records) {
            if (!r.student) continue;
            const studentId = new mongoose.Types.ObjectId(r.student);  // explicit cast

            await StudentAttendance.findOneAndUpdate(
                { student: studentId, date: storedDate },               // match filter
                {
                    $set: {
                        status:   r.status || 'Absent',
                        course:   courseId,
                        notes:    r.notes  || '',
                        markedBy: savedBy,
                    },
                },
                { upsert: true, new: true }
            );
            saved++;
        }

        console.log(`[Attendance] Saved ${saved} records for ${date} (stored as ${storedDate.toISOString()})`);
        res.json({ message: `Attendance saved for ${saved} students`, saved });
    } catch (err) {
        console.error('[Attendance] Bulk save error:', err.message);
        res.status(500).json({ message: err.message });
    }
});

// ─── POST / — mark single student attendance ───────────────────────────────
router.post('/', protect, hrOnly, async (req, res) => {
    try {
        const { student, date, status, course, notes } = req.body;
        const record = await StudentAttendance.findOneAndUpdate(
            { student: new mongoose.Types.ObjectId(student), date: dayStart(date) },
            { $set: { status, course: course || null, notes: notes || '', markedBy: req.user._id } },
            { upsert: true, new: true }
        ).populate('student', 'name studentId');
        res.json(record);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── PUT /:id — edit existing attendance record ────────────────────────────
router.put('/:id', protect, hrOnly, async (req, res) => {
    try {
        const record = await StudentAttendance.findByIdAndUpdate(
            req.params.id,
            { $set: { ...req.body, markedBy: req.user._id } },
            { new: true }
        ).populate('student', 'name studentId').populate('course', 'courseName');
        if (!record) return res.status(404).json({ message: 'Record not found' });
        res.json(record);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── GET /report/summary — aggregated attendance report ────────────────────
router.get('/report/summary', protect, hrOnly, async (req, res) => {
    try {
        const { startDate, endDate, course } = req.query;
        const matchStage = {};

        if (startDate && endDate) {
            matchStage.date = { $gte: dayStart(startDate), $lte: dayEnd(endDate) };
        }
        if (course) {
            matchStage.course = new mongoose.Types.ObjectId(course);
        }

        const summary = await StudentAttendance.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$student',
                    total:   { $sum: 1 },
                    present: { $sum: { $cond: [{ $eq: ['$status', 'Present'] }, 1, 0] } },
                    absent:  { $sum: { $cond: [{ $eq: ['$status', 'Absent']  }, 1, 0] } },
                    late:    { $sum: { $cond: [{ $eq: ['$status', 'Late']    }, 1, 0] } },
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
            { $unwind: { path: '$studentInfo', preserveNullAndEmptyArrays: false } },
            {
                $project: {
                    name:       '$studentInfo.name',
                    studentId:  '$studentInfo.studentId',
                    total: 1, present: 1, absent: 1, late: 1,
                    percentage: {
                        $multiply: [
                            { $divide: ['$present', { $max: ['$total', 1] }] },
                            100,
                        ],
                    },
                },
            },
            { $sort: { name: 1 } },
        ]);

        res.json(summary);
    } catch (err) {
        console.error('[Attendance] Report error:', err.message);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
