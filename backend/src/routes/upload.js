const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { protect } = require('../middleware/auth');
const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  // Check if file is an image
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Upload image endpoint
router.post('/image', protect, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    // Generate URL for the uploaded file
    const fileUrl = `/uploads/${req.file.filename}`;

    res.json({
      success: true,
      message: 'Image uploaded successfully',
      url: fileUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload image',
      error: error.message
    });
  }


});

// Upload OG/OpenGraph image with resize to 1200x630 and optimization
router.post('/image/og', protect, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    const inputPath = path.join(uploadsDir, req.file.filename);
    const ext = path.extname(req.file.originalname).toLowerCase();
    const baseName = path.basename(req.file.filename, path.extname(req.file.filename));
    const outName = `${baseName}-og.jpg`;
    const outputPath = path.join(uploadsDir, outName);

    // Resize to 1200x630, center crop, and output JPEG with good quality
    await sharp(inputPath)
      .resize(1200, 630, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 82, mozjpeg: true, progressive: true })
      .toFile(outputPath);

    // Optionally keep original; do not delete input in case needed elsewhere
    const fileUrl = `/uploads/${outName}`;

    return res.json({
      success: true,
      message: 'OG image uploaded and optimized successfully',
      url: fileUrl,
      filename: outName,
      originalName: req.file.originalname,
      size: fs.statSync(outputPath).size
    });
  } catch (error) {
    console.error('Upload OG image error:', error);
    return res.status(500).json({ success: false, message: 'Failed to process OG image', error: error.message });
  }
});



// Delete image endpoint
router.delete('/image/:filename', protect, async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(uploadsDir, filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Delete the file
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      message: 'Image deleted successfully'
    });

  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete image',
      error: error.message
    });
  }
});

// Get image info endpoint
router.get('/image/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(uploadsDir, filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Get file stats
    const stats = fs.statSync(filePath);

    res.json({
      success: true,
      filename: filename,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime
    });

  } catch (error) {
    console.error('Get image info error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get image info',
      error: error.message
    });
  }
});

module.exports = router;
