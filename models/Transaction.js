const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['deposit', 'withdraw', 'buy', 'sell', 'mining', 'airdrop', 'admin_deposit'],
        required: true
    },
    amount: { type: Number, required: true },
    
    // For trades
    coin: String,
    coinAmount: Number,
    price: Number,
    
    // For withdrawals
    address: String,
    network: String,
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'completed'],
        default: 'completed'
    },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    decidedAt: Date,

    // Description
    action: { type: String, required: true },
    
    // Extra metadata
    extra: mongoose.Schema.Types.Mixed
}, {
    timestamps: true
});

// Index for fast queries
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ type: 1, status: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
