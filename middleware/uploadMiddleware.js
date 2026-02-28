const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const ensureDirectoryExists = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

// Storage configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let uploadPath;

        if (file.fieldname === 'images') {
            uploadPath = 'uploads/announcements/images';
        } else if (file.fieldname === 'videos') {
            uploadPath = 'uploads/announcements/videos';
        } else {
            uploadPath = 'uploads/announcements';
        }

        ensureDirectoryExists(uploadPath);
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    if (file.fieldname === 'images') {
        // Accept images only
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed for images field'), false);
        }
    } else if (file.fieldname === 'videos') {
        // Accept videos only
        if (file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Only video files are allowed for videos field'), false);
        }
    } else {
        cb(null, true);
    }
};

// Create multer instance
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024  // 50MB max file size
    }
});

// Export configured upload middleware
module.exports = {
    uploadAnnouncementFiles: upload.fields([
        { name: 'images', maxCount: 10 },
        { name: 'videos', maxCount: 5 }
    ])
};
