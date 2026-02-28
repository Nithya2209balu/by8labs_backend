const PDFDocument = require('pdfkit');
const { toWords } = require('number-to-words');

/**
 * Generate salary slip PDF
 * @param {Object} payroll - Payroll document with populated employee data
 * @returns {PDFDocument} PDF document stream
 */
/**
 * Generate salary slip PDF
 * @param {Object} payroll - Payroll document with populated employee data
 * @param {boolean} withTax - Whether to include tax deductions
 * @returns {PDFDocument} PDF document stream
 */
function generateSalarySlipPDF(payroll, withTax = true) {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    const employee = payroll.employeeId;
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = monthNames[payroll.month - 1];

    // Calculate adjusted values based on withTax flag
    let totalDeductions = payroll.totalDeductions;
    let netPayable = payroll.netPayableSalary;

    if (!withTax) {
        // Remove tax components from deductions
        // totalDeductions includes: lopAmount + totalTax + advanceDeduction + timeDeductions + otherDeductions
        // We subtract totalTax
        totalDeductions = (payroll.totalDeductions || 0) - (payroll.totalTax || 0);

        // Add back tax to net pay
        netPayable = (payroll.netPayableSalary || 0) + (payroll.totalTax || 0);
    }

    // Title
    doc.fontSize(24).font('Helvetica-Bold').text('Salary Slip', { align: 'center' });
    doc.fontSize(14).font('Helvetica').text(`${monthName} ${payroll.year}`, { align: 'center' });

    if (!withTax) {
        doc.fontSize(10).font('Helvetica-Oblique').text('(Tax Deductions Excluded)', { align: 'center' });
    }

    doc.moveDown(2);

    // Employee Details Section
    doc.fontSize(14).font('Helvetica-Bold').text('Employee Details');
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica');
    doc.text(`EID: ${employee.employeeId || 'N/A'}`);
    doc.text(`Name: ${employee.firstName} ${employee.lastName}`);
    doc.text(`Designation: ${employee.designation || 'N/A'}`);
    doc.text(`Date of Joining: ${employee.joiningDate ? new Date(employee.joiningDate).toLocaleDateString('en-GB') : 'N/A'}`);
    doc.moveDown(1.5);

    // Pay Period Section
    doc.fontSize(14).font('Helvetica-Bold').text('Pay Period');
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica');
    const startDate = `01/${payroll.month.toString().padStart(2, '0')}/${payroll.year}`;
    const endDate = new Date(payroll.year, payroll.month, 0).getDate();
    const endDateStr = `${endDate}/${payroll.month.toString().padStart(2, '0')}/${payroll.year}`;
    doc.text(`Pay Cycle Start: ${startDate}`);
    doc.text(`Pay Cycle End: ${endDateStr}`);
    doc.moveDown(1.5);

    // Attendance Section
    doc.fontSize(14).font('Helvetica-Bold').text('Attendance');
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica');
    doc.text(`Total Working Days: ${payroll.totalWorkingDays}`);
    doc.text(`No. of Absent Days: ${payroll.absentDays}`);
    doc.text(`Actual Working Days: ${payroll.actualWorkingDays}`);
    doc.moveDown(1.5);

    // Bank Details Section
    if (employee.bankDetails && employee.bankDetails.bankName) {
        doc.fontSize(14).font('Helvetica-Bold').text('Bank Details');
        doc.moveDown(0.5);
        doc.fontSize(11).font('Helvetica');
        doc.text(`Bank Name: ${employee.bankDetails.bankName}`);
        doc.text(`Account No: ${employee.bankDetails.accountNumber || 'N/A'}`);
        doc.text(`Branch: ${employee.bankDetails.branch || 'N/A'}`);
        doc.moveDown(1.5);
    }

    // Time & Deductions Section
    doc.fontSize(14).font('Helvetica-Bold').text('Time & Deductions');
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica');
    const lateHours = Math.floor((payroll.lateArrivalMinutes || 0) / 60);
    const lateMinutes = (payroll.lateArrivalMinutes || 0) % 60;
    const earlyHours = Math.floor((payroll.earlyLeavingMinutes || 0) / 60);
    const earlyMinutes = (payroll.earlyLeavingMinutes || 0) % 60;
    doc.text(`Late Arrival: ${lateHours}h ${lateMinutes}m (${payroll.lateArrivalMinutes || 0} mins) – Deduction: ${(payroll.timeDeductions || 0).toFixed(2)}`);
    doc.text(`Early Leaving: ${earlyHours}h ${earlyMinutes}m (payroll.earlyLeavingMinutes || 0) mins) – Deduction: 0.00`);

    // Explicitly show tax info if included
    if (withTax) {
        doc.text(`Tax Deductions (PF+ESI+PT+TDS): ${(payroll.totalTax || 0).toFixed(2)}`);
    } else {
        doc.text(`Tax Deductions: Excluded from calculation`);
    }

    doc.moveDown(1.5);

    // Salary Description Table
    doc.fontSize(14).font('Helvetica-Bold').text('Salary Description');
    doc.moveDown(0.5);

    const tableTop = doc.y;
    const col1X = 50;
    const col2X = 400;

    // Table headers
    doc.fontSize(11).font('Helvetica-Bold');
    doc.text('Description', col1X, tableTop);
    doc.text('Amount', col2X, tableTop);
    doc.moveDown(0.5);

    // Draw line under headers
    doc.moveTo(col1X, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.3);

    // Table rows
    doc.font('Helvetica');
    const addRow = (description, amount, isBold = false) => {
        if (isBold) doc.font('Helvetica-Bold');
        doc.text(description, col1X, doc.y);
        doc.text((amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), col2X, doc.y);
        if (isBold) doc.font('Helvetica');
        doc.moveDown(0.5);
    };

    addRow('Monthly Salary', payroll.monthlySalary || 0);
    addRow('Actual Salary (after LOP)', payroll.actualSalary || 0);
    addRow('Incentives', payroll.incentives || 0);
    addRow('Advance Taken', payroll.advance || 0);
    addRow('Advance Deduction', -(payroll.advanceDeduction || 0));

    // Show total deductions (adjusted)
    addRow(`Total Deductions ${withTax ? '' : '(excl. Tax)'}`, -(totalDeductions || 0));

    doc.moveDown(0.3);
    doc.moveTo(col1X, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    addRow('Net Payable Salary', netPayable || 0, true);

    doc.moveDown(1);

    // Amount in words
    const amountInWords = convertToWords(Math.round(netPayable || 0));
    doc.fontSize(11).font('Helvetica-Bold').text('Amount in Words:');
    doc.font('Helvetica').text(amountInWords);

    // Don't call doc.end() here - let the piping in the route handler manage the stream
    return doc;
}

/**
 * Convert number to words in Indian format
 * @param {number} amount - Amount to convert
 * @returns {string} Amount in words
 */
function convertToWords(amount) {
    if (amount === 0) return 'Zero Rupees Only';

    try {
        const words = toWords(amount);
        // Capitalize first letter and add 'Rupees Only'
        const capitalized = words.charAt(0).toUpperCase() + words.slice(1);
        return `${capitalized} Rupees Only`;
    } catch (error) {
        return 'Amount conversion error';
    }
}

module.exports = { generateSalarySlipPDF };
