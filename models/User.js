const express = require('express');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const SupportTicket = require('../models/SupportTicket');
const { auth, requireVerified } = require('../middleware/auth');

const router = express.Router();

// All routes require auth
router.use(auth);

// =====================
// GET BALANCE & PORTFOLIO
// =====================
router.get('/portfolio', async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('balanceUSDT portfolio totalMined');
        res.json({
            balance: user.balanceUSDT,
            portfolio: user.portfolio,
            totalMined: user.totalMined
        });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

// =====================
// BUY COIN
// =====================
router.post('/buy', requireVerified, async (req, res) => {
    try {
        const { symbol, usdtAmount, coinAmount, price } = req.body;

        if (!symbol || !usdtAmount || usdtAmount <= 0 || !price) {
            return res.status(400).json({ error: 'Некорректные данные' });
        }

        const user = await User.findById(req.userId);
        if (user.balanceUSDT < usdtAmount) {
            return res.status(400).json({ error: 'Недостаточно средств' });
        }

        // Deduct USDT
        user.balanceUSDT -= usdtAmount;

        // Add to portfolio
        let existing = user.portfolio.find(p => p.symbol === symbol);
        if (existing) {
            const totalValue = existing.amount * existing.avgBuyPrice + coinAmount * price;
            existing.amount += coinAmount;
            existing.avgBuyPrice = totalValue / existing.amount;
        } else {
            user.portfolio.push({ symbol, amount: coinAmount, avgBuyPrice: price });
        }

        await user.save();

        await Transaction.create({
            userId: user._id,
            type: 'buy',
            amount: usdtAmount,
            coin: symbol,
            coinAmount,
            price,
            action: 'Покупка ' + coinAmount.toFixed(6) + ' ' + symbol + ' за ' + usdtAmount.toFixed(2) + '$'
        });

        res.json({
            message: 'Куплено ' + coinAmount.toFixed(6) + ' ' + symbol,
            balance: user.balanceUSDT,
            portfolio: user.portfolio
        });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

// =====================
// SELL COIN
// =====================
router.post('/sell', requireVerified, async (req, res) => {
    try {
        const { symbol, coinAmount, usdtAmount, price } = req.body;

        const user = await User.findById(req.userId);
        let existing = user.portfolio.find(p => p.symbol === symbol);

        if (!existing || existing.amount < coinAmount) {
            return res.status(400).json({ error: 'Недостаточно монет' });
        }

        // Remove coins
        existing.amount -= coinAmount;
        if (existing.amount < 0.000001) {
            user.portfolio = user.portfolio.filter(p => p.symbol !== symbol);
        }

        // Add USDT
        user.balanceUSDT += usdtAmount;
        await user.save();

        await Transaction.create({
            userId: user._id,
            type: 'sell',
            amount: usdtAmount,
            coin: symbol,
            coinAmount,
            price,
            action: 'Продажа ' + coinAmount.toFixed(6) + ' ' + symbol + ' за ' + usdtAmount.toFixed(2) + '$'
        });

        res.json({
            message: 'Продано ' + coinAmount.toFixed(6) + ' ' + symbol,
            balance: user.balanceUSDT,
            portfolio: user.portfolio
        });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

// =====================
// WITHDRAW REQUEST
// =====================
router.post('/withdraw', requireVerified, async (req, res) => {
    try {
        const { amount, address, network } = req.body;

        if (!amount || amount <= 0 || !address || !network) {
            return res.status(400).json({ error: 'Заполните все поля' });
        }

        const user = await User.findById(req.userId);
        if (user.balanceUSDT < amount) {
            return res.status(400).json({ error: 'Недостаточно средств' });
        }

        // Freeze funds
        user.balanceUSDT -= amount;
        await user.save();

        await Transaction.create({
            userId: user._id,
            type: 'withdraw',
            amount,
            address,
            network,
            status: 'pending',
            action: 'Запрос на вывод: ' + amount.toFixed(2) + '$ → ' + address.slice(0, 10) + '...'
        });

        res.json({ message: 'Запрос на вывод создан', balance: user.balanceUSDT });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

// =====================
// TRANSACTION HISTORY
// =====================
router.get('/history', async (req, res) => {
    try {
        const { type, limit = 50 } = req.query;
        const filter = { userId: req.userId };
        if (type && type !== 'all') filter.type = type;

        const transactions = await Transaction.find(filter)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));

        res.json({ transactions });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

// =====================
// MINING — ADD EARNINGS
// =====================
router.post('/mining/earn', async (req, res) => {
    try {
        const { amount } = req.body;
        if (!amount || amount <= 0 || amount > 1) {
            return res.status(400).json({ error: 'Некорректная сумма' });
        }

        const user = await User.findById(req.userId);
        user.balanceUSDT += amount;
        user.totalMined += amount;
        await user.save();

        // Log every minute (not every tick)
        if (amount > 0.001) {
            await Transaction.create({
                userId: user._id,
                type: 'mining',
                amount,
                action: 'Майнинг: +' + amount.toFixed(6) + '$ за сессию'
            });
        }

        res.json({ balance: user.balanceUSDT, totalMined: user.totalMined });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

// =====================
// SUPPORT — CREATE TICKET
// =====================
router.post('/support', async (req, res) => {
    try {
        const { subject, message } = req.body;
        if (!subject || !message) {
            return res.status(400).json({ error: 'Заполните все поля' });
        }

        const ticket = await SupportTicket.create({
            userId: req.userId,
            subject,
            messages: [{ sender: 'user', text: message }]
        });

        res.status(201).json({ ticket });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

// =====================
// SUPPORT — GET MY TICKETS
// =====================
router.get('/support', async (req, res) => {
    try {
        const tickets = await SupportTicket.find({ userId: req.userId })
            .sort({ updatedAt: -1 });
        res.json({ tickets });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

// =====================
// SUPPORT — SEND MESSAGE
// =====================
router.post('/support/:ticketId/message', async (req, res) => {
    try {
        const { text } = req.body;
        const ticket = await SupportTicket.findOne({ _id: req.params.ticketId, userId: req.userId });
        if (!ticket) return res.status(404).json({ error: 'Тикет не найден' });

        ticket.messages.push({ sender: 'user', text });
        ticket.status = 'open';
        await ticket.save();

        res.json({ message: 'Отправлено' });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

// =====================
// KYC — SUBMIT
// =====================
router.post('/kyc', async (req, res) => {
    try {
        const { fullName, docType, frontPhoto, backPhoto, selfiePhoto } = req.body;

        const user = await User.findById(req.userId);
        user.kycStatus = 'pending';
        user.kycData = {
            fullName,
            docType,
            frontPhoto,
            backPhoto,
            selfiePhoto,
            submittedAt: new Date()
        };
        await user.save();

        res.json({ message: 'KYC отправлен на проверку' });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

// =====================
// AVATAR — SAVE
// =====================
router.post('/avatar', async (req, res) => {
    try {
        const { avatar } = req.body;
        if (!avatar) return res.status(400).json({ error: 'Нет данных' });
        if (avatar.length > 2 * 1024 * 1024) return res.status(400).json({ error: 'Файл слишком большой' });

        const user = await User.findById(req.userId);
        user.avatar = avatar;
        await user.save();

        res.json({ message: 'Аватар сохранён' });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

// =====================
// AVATAR — DELETE
// =====================
router.delete('/avatar', async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        user.avatar = undefined;
        await user.save();

        res.json({ message: 'Аватар удалён' });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

module.exports = router;
