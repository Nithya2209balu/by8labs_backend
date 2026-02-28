// Middleware to check if employee has data access
// HR users bypass this check
const checkDataAccess = (req, res, next) => {
    // HR users always have full access
    if (req.user.role === 'HR') {
        return next();
    }

    // Check if employee has data access
    if (!req.user.hasDataAccess) {
        return res.status(403).json({
            message: 'Access denied. Please request data access from HR to use this feature.',
            requiresDataAccess: true
        });
    }

    next();
};

module.exports = checkDataAccess;
