const express = require('express');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const AdminLog = require('../models/AdminLog');
const SupportTicket = require('../models/SupportTicket');
const { auth, requireAdmin, requireSuperAdmin } = require('../middleware/auth');

const router = express.Router();

// All admin routes require auth + admin role
router.use(auth, requireAdmin);

// Helper: log admin action
async function logAdmin(adminId, action, targetUserId, details, ip) {
    await AdminLog.create({ adminId, action, targetUserId, details, ip });
}

// =====================
// GET ALL USERS
// =====================
router.get('/users', async (req, res) => {
    try {
        const users = await User.find()
            .select('-password -twoFactorSecret')
            .sort({ createdAt: -1 })
            .limit(200);
        res.json({ users });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

// =====================
// GET USER BY ID
// =====================
router.get('/users/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password -twoFactorSecret');
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
        
        const transactions = await Transaction.find({ userId: user._id })
            .sort({ createdAt: -1 }).limit(50);
        
        res.json({ user, transactions });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

// =====================
// ADD BALANCE TO USER
// =====================
router.post('/deposit', async (req, res) => {
    try {
        const { userId, amount } = req.body;
        if (!userId || !amount || amount <= 0) {
            return res.status(400).json({ error: 'Укажите ID и сумму' });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

        user.balanceUSDT += amount;
        await user.save();

        await Transaction.create({
            userId: user._id,
            type: 'admin_deposit',
            amount,
            action: 'Пополнение от администратора: +' + amount.toFixed(2) + '$',
            extra: { adminId: req.userId }
        });

        await logAdmin(req.userId, 'deposit', user._id, { amount }, req.ip);

        res.json({ message: 'Баланс пополнен: +' + amount.toFixed(2) + '$', balance: user.balanceUSDT });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

// =====================
// WITHDRAW REQUESTS
// =====================
router.get('/withdrawals', async (req, res) => {
    try {
        const withdrawals = await Transaction.find({ type: 'withdraw' })
            .populate('userId', 'name email trustId')
            .sort({ createdAt: -1 })
            .limit(100);
        res.json({ withdrawals });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

router.post('/withdrawals/:id/decide', async (req, res) => {
    try {
        const { decision } = req.body; // 'approved' or 'rejected'
        const tx = await Transaction.findById(req.params.id);
        if (!tx) return res.status(404).json({ error: 'Запрос не найден' });

        tx.status = decision;
        tx.decidedBy = req.userId;
        tx.decidedAt = new Date();

        if (decision === 'rejected') {
            // Return funds
            const user = await User.findById(tx.userId);
            if (user) {
                user.balanceUSDT += tx.amount;
                await user.save();
            }
            tx.action = '✗ Вывод отклонён: ' + tx.amount.toFixed(2) + '$';
        } else {
            tx.action = '✔ Вывод выполнен: ' + tx.amount.toFixed(2) + '$';
        }

        await tx.save();
        await logAdmin(req.userId, 'withdraw_' + decision, tx.userId, { amount: tx.amount, txId: tx._id }, req.ip);

        res.json({ message: decision === 'approved' ? 'Вывод подтверждён' : 'Вывод отклонён' });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

// =====================
// KYC MANAGEMENT
// =====================
router.get('/kyc', async (req, res) => {
    try {
        const users = await User.find({ kycStatus: { $ne: 'none' } })
            .select('name email trustId kycStatus kycData createdAt')
            .sort({ 'kycData.submittedAt': -1 });
        res.json({ users });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

router.post('/kyc/:userId/decide', async (req, res) => {
    try {
        const { decision } = req.body; // 'verified' or 'rejected'
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

        user.kycStatus = decision;
        user.kycData.reviewedAt = new Date();
        user.kycData.reviewedBy = req.userId;
        await user.save();

        await logAdmin(req.userId, 'kyc_' + decision, user._id, {}, req.ip);

        res.json({ message: 'KYC ' + (decision === 'verified' ? 'подтверждён' : 'отклонён') });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

// =====================
// SUPPORT TICKETS
// =====================
router.get('/support', async (req, res) => {
    try {
        const tickets = await SupportTicket.find()
            .populate('userId', 'name email trustId')
            .sort({ updatedAt: -1 })
            .limit(50);
        res.json({ tickets });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

router.post('/support/:ticketId/reply', async (req, res) => {
    try {
        const { text } = req.body;
        const ticket = await SupportTicket.findById(req.params.ticketId);
        if (!ticket) return res.status(404).json({ error: 'Тикет не найден' });

        ticket.messages.push({ sender: 'admin', text, adminId: req.userId });
        ticket.status = 'replied';
        await ticket.save();

        res.json({ message: 'Ответ отправлен' });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

// =====================
// BAN / UNBAN USER
// =====================
router.post('/users/:id/ban', async (req, res) => {
    try {
        const { reason } = req.body;
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'Не найден' });
        if (user.role === 'superadmin') return res.status(403).json({ error: 'Нельзя заблокировать суперадмина' });

        user.isBanned = true;
        user.banReason = reason || 'Заблокирован администратором';
        await user.save();

        await logAdmin(req.userId, 'ban_user', user._id, { reason }, req.ip);
        res.json({ message: 'Пользователь заблокирован' });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

router.post('/users/:id/unban', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'Не найден' });

        user.isBanned = false;
        user.banReason = undefined;
        await user.save();

        await logAdmin(req.userId, 'unban_user', user._id, {}, req.ip);
        res.json({ message: 'Пользователь разблокирован' });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

// =====================
// ADMIN LOGS (superadmin only)
// =====================
router.get('/logs', requireSuperAdmin, async (req, res) => {
    try {
        const logs = await AdminLog.find()
            .populate('adminId', 'name email trustId')
            .populate('targetUserId', 'name email trustId')
            .sort({ createdAt: -1 })
            .limit(200);
        res.json({ logs });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

// =====================
// MANAGE ADMINS (superadmin only)
// =====================
router.post('/set-role', requireSuperAdmin, async (req, res) => {
    try {
        const { userId, role } = req.body;
        if (!['user', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Недопустимая роль' });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'Не найден' });
        if (user.role === 'superadmin') return res.status(403).json({ error: 'Нельзя изменить роль суперадмина' });

        const oldRole = user.role;
        user.role = role;
        await user.save();

        await logAdmin(req.userId, 'change_role', user._id, { from: oldRole, to: role }, req.ip);
        res.json({ message: 'Роль изменена: ' + oldRole + ' → ' + role });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

// =====================
// PLATFORM STATS
// =====================
router.get('/stats', async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const verifiedUsers = await User.countDocuments({ emailVerified: true });
        const pendingKyc = await User.countDocuments({ kycStatus: 'pending' });
        const pendingWithdrawals = await Transaction.countDocuments({ type: 'withdraw', status: 'pending' });
        const openTickets = await SupportTicket.countDocuments({ status: 'open' });
        const totalDeposited = await Transaction.aggregate([
            { $match: { type: { $in: ['deposit', 'admin_deposit'] } } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        res.json({
            totalUsers,
            verifiedUsers,
            pendingKyc,
            pendingWithdrawals,
            openTickets,
            totalDeposited: totalDeposited[0]?.total || 0
        });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

module.exports = router;
