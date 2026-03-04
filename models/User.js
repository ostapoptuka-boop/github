const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    trustId: {
        type: String,
        unique: true
    },
    role: {
        type: String,
        enum: ['user', 'admin', 'superadmin'],
        default: 'user'
    },
    
    // Email verification
    emailVerified: { type: Boolean, default: false },
    emailVerifyToken: String,
    emailVerifyExpires: Date,

    // 2FA
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: String,

    // Password reset
    resetPasswordToken: String,
    resetPasswordExpires: Date,

    // Balances
    balanceUSDT: { type: Number, default: 0 },
    
    // Portfolio — coins owned
    portfolio: [{
        symbol: String,
        amount: { type: Number, default: 0 },
        avgBuyPrice: { type: Number, default: 0 }
    }],

    // KYC
    kycStatus: {
        type: String,
        enum: ['none', 'pending', 'verified', 'rejected'],
        default: 'none'
    },
    kycData: {
        fullName: String,
        docType: String,
        frontPhoto: String,
        backPhoto: String,
        selfiePhoto: String,
        submittedAt: Date,
        reviewedAt: Date,
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    },

    // Mining
    minerServer: { type: String, default: null },
    minerConfig: {
        algo: { type: String, default: 'sha256' },
        threads: { type: String, default: 'auto' },
        gpu: { type: Number, default: 65 },
        pool: { type: String, default: 'eu' },
        payout: { type: Number, default: 0.005 },
        ddos: { type: Number, default: 3 },
        restart: { type: String, default: 'instant' },
        bw: { type: Number, default: 2048 },
        temp: { type: Number, default: 75 },
        stealth: { type: String, default: 'active' }
    },
    totalMined: { type: Number, default: 0 },

    // Avatar
    avatar: String,

    // Account status
    isActive: { type: Boolean, default: true },
    isBanned: { type: Boolean, default: false },
    banReason: String,

    // Last activity
    lastLogin: Date,
    lastIP: String
}, {
    timestamps: true // createdAt, updatedAt
});

// Generate unique Trust ID before save
userSchema.pre('save', async function(next) {
    // Generate Trust ID
    if (!this.trustId) {
        const count = await mongoose.model('User').countDocuments();
        this.trustId = String(10001 + count).padStart(5, '0');
    }
    // Hash password
    if (this.isModified('password')) {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
    }
    next();
});

// Compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// Return safe user data (no password)
userSchema.methods.toSafeObject = function() {
    const obj = this.toObject();
    delete obj.password;
    delete obj.twoFactorSecret;
    delete obj.emailVerifyToken;
    delete obj.resetPasswordToken;
    return obj;
};

module.exports = mongoose.model('User', userSchema);
