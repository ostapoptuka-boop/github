const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const validator = require('validator');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const User = require('../models/User');
const AdminLog = require('../models/AdminLog');
const { auth, requireVerified } = require('../middleware/auth');
const { sendVerificationEmail } = require('../utils/email');

const router = express.Router();

// Generate JWT
function generateToken(userId) {
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

// =====================
// REGISTER
// =====================
router.post('/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;

        // Validation
        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Заполните все поля' });
        }
        if (!validator.isEmail(email)) {
            return res.status(400).json({ error: 'Некорректный email' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Пароль минимум 6 символов' });
        }
        if (name.length < 2 || name.length > 50) {
            return res.status(400).json({ error: 'Имя от 2 до 50 символов' });
        }

        // Check if exists
        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(400).json({ error: 'Email уже зарегистрирован' });
        }

        // Create verification token
        const verifyToken = crypto.randomBytes(32).toString('hex');

        // Create user
        const user = new User({
            email,
            password,
            name: validator.escape(name),
            emailVerifyToken: verifyToken,
            emailVerifyExpires: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
        });

        await user.save();

        // Send verification email
        try {
            await sendVerificationEmail(email, verifyToken, name);
        } catch (emailErr) {
            console.error('Email send failed:', emailErr.message);
            // Still register, just without email verification
        }

        const token = generateToken(user._id);

        res.status(201).json({
            message: 'Регистрация успешна! Проверьте email для подтверждения.',
            token,
            user: user.toSafeObject()
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// =====================
// LOGIN
// =====================
router.post('/login', async (req, res) => {
    try {
        const { email, password, twoFactorCode } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Введите email и пароль' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }

        if (user.isBanned) {
            return res.status(403).json({ error: 'Аккаунт заблокирован', reason: user.banReason });
        }

        // Check 2FA
        if (user.twoFactorEnabled) {
            if (!twoFactorCode) {
                return res.status(200).json({ requires2FA: true, message: 'Введите код из Google Authenticator' });
            }
            const verified = speakeasy.totp.verify({
                secret: user.twoFactorSecret,
                encoding: 'base32',
                token: twoFactorCode,
                window: 2
            });
            if (!verified) {
                return res.status(401).json({ error: 'Неверный код 2FA' });
            }
        }

        // Update last login
        user.lastLogin = new Date();
        user.lastIP = req.ip;
        await user.save();

        const token = generateToken(user._id);

        res.json({
            token,
            user: user.toSafeObject()
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// =====================
// VERIFY EMAIL
// =====================
router.get('/verify-email/:token', async (req, res) => {
    try {
        const user = await User.findOne({
            emailVerifyToken: req.params.token,
            emailVerifyExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ error: 'Недействительная или просроченная ссылка' });
        }

        user.emailVerified = true;
        user.emailVerifyToken = undefined;
        user.emailVerifyExpires = undefined;
        await user.save();

        // Redirect to site with success
        res.redirect(process.env.FRONTEND_URL + '?emailVerified=true');
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// =====================
// GET CURRENT USER
// =====================
router.get('/me', auth, async (req, res) => {
    res.json({ user: req.user.toSafeObject() });
});

// =====================
// SETUP 2FA
// =====================
router.post('/2fa/setup', auth, async (req, res) => {
    try {
        const secret = speakeasy.generateSecret({
            name: 'TrustDrop (' + req.user.email + ')',
            issuer: 'TrustDrop'
        });

        // Save secret temporarily
        req.user.twoFactorSecret = secret.base32;
        await req.user.save();

        // Generate QR code
        const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

        res.json({
            secret: secret.base32,
            qrCode: qrCodeUrl
        });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка настройки 2FA' });
    }
});

// =====================
// VERIFY & ENABLE 2FA
// =====================
router.post('/2fa/verify', auth, async (req, res) => {
    try {
        const { code } = req.body;
        
        const verified = speakeasy.totp.verify({
            secret: req.user.twoFactorSecret,
            encoding: 'base32',
            token: code,
            window: 2
        });

        if (!verified) {
            return res.status(400).json({ error: 'Неверный код. Попробуйте ещё раз.' });
        }

        req.user.twoFactorEnabled = true;
        await req.user.save();

        res.json({ message: '2FA успешно включена!' });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка верификации' });
    }
});

// =====================
// DISABLE 2FA
// =====================
router.post('/2fa/disable', auth, async (req, res) => {
    try {
        const { code } = req.body;
        
        const verified = speakeasy.totp.verify({
            secret: req.user.twoFactorSecret,
            encoding: 'base32',
            token: code,
            window: 2
        });

        if (!verified) {
            return res.status(400).json({ error: 'Неверный код' });
        }

        req.user.twoFactorEnabled = false;
        req.user.twoFactorSecret = undefined;
        await req.user.save();

        res.json({ message: '2FA отключена' });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

// =====================
// CHANGE PASSWORD
// =====================
router.post('/change-password', auth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Заполните все поля' });
        }

        const user = await User.findById(req.userId);
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({ error: 'Неверный текущий пароль' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Новый пароль минимум 6 символов' });
        }

        user.password = newPassword;
        await user.save();

        res.json({ message: 'Пароль изменён!' });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

module.exports = router;
