const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT token
const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'Необходима авторизация' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password -twoFactorSecret');
        
        if (!user) {
            return res.status(401).json({ error: 'Пользователь не найден' });
        }

        if (user.isBanned) {
            return res.status(403).json({ error: 'Аккаунт заблокирован', reason: user.banReason });
        }

        if (!user.isActive) {
            return res.status(403).json({ error: 'Аккаунт деактивирован' });
        }

        req.user = user;
        req.userId = user._id;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Сессия истекла, войдите снова' });
        }
        res.status(401).json({ error: 'Недействительный токен' });
    }
};

// Require email verification
const requireVerified = (req, res, next) => {
    if (!req.user.emailVerified) {
        return res.status(403).json({ error: 'Подтвердите email для доступа' });
    }
    next();
};

// Require admin role
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Доступ запрещён' });
    }
    next();
};

// Require superadmin role
const requireSuperAdmin = (req, res, next) => {
    if (req.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Доступ только для главного администратора' });
    }
    next();
};

module.exports = { auth, requireVerified, requireAdmin, requireSuperAdmin };
