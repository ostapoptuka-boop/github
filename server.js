require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// =====================
// SECURITY MIDDLEWARE
// =====================
app.use(helmet({
    contentSecurityPolicy: false, // Allow inline scripts in our frontend
    crossOriginEmbedderPolicy: false
}));

app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true
}));

// Rate limiting — prevent brute force
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 requests per window
    message: { error: 'Слишком много попыток. Подождите 15 минут.' },
    standardHeaders: true,
    legacyHeaders: false
});

const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: { error: 'Слишком много запросов. Подождите.' }
});

// Body parser
app.use(express.json({ limit: '10mb' })); // 10mb for KYC photos
app.use(express.urlencoded({ extended: true }));

// Trust proxy (for Render)
app.set('trust proxy', 1);

// =====================
// API ROUTES
// =====================
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/user', apiLimiter, userRoutes);
app.use('/api/admin', apiLimiter, adminRoutes);

// =====================
// SERVE FRONTEND
// =====================
app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// =====================
// ERROR HANDLER
// =====================
app.use((err, req, res, next) => {
    console.error('Server Error:', err.message);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

// =====================
// CONNECT DB & START
// =====================
async function start() {
    try {
        // Connect to MongoDB
        if (process.env.MONGODB_URI) {
            await mongoose.connect(process.env.MONGODB_URI);
            console.log('✓ MongoDB connected');
        } else {
            console.log('⚠ No MONGODB_URI — running without database');
        }

        app.listen(PORT, () => {
            console.log(`✓ TrustDrop server running on port ${PORT}`);
            console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
        });
    } catch (error) {
        console.error('Failed to start:', error.message);
        // Start without DB for static serving
        app.listen(PORT, () => {
            console.log(`⚠ TrustDrop running on port ${PORT} (no database)`);
        });
    }
}

start();
