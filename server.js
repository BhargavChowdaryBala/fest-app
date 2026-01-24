require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const multer = require('multer');

const User = require('./models/User');
const Order = require('./models/Order');
const UserDetails = require('./models/UserDetails');
const Item = require('./models/Item');

const app = express();

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ================= STATIC FILES ================= */
const uploadsPath = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use(express.static('public'));
app.use('/uploads', express.static(uploadsPath));

/* ================= DATABASE ================= */
mongoose.connect(process.env.MONGO_URI, { dbName: 'fest_users' })
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error('❌ MongoDB Error:', err));

/* ================= EMAIL (SENDGRID) ================= */
const transporter = nodemailer.createTransport({
    service: 'SendGrid',
    auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY
    }
});

transporter.verify(err => {
    if (err) console.error('❌ SendGrid Error:', err);
    else console.log('✅ SendGrid transporter ready');
});

/* ================= RAZORPAY ================= */
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const ADMIN_PIN = process.env.ADMIN_DASHBOARD_PASSWORD || '1234';

/* ================= CONFIG ================= */
app.get('/api/config', (req, res) => {
    console.log('➡️ /api/config');
    res.json({
        merchantName: process.env.MERCHANT_NAME,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID
    });
});

/* ================= AUTH ================= */
// Signup
app.post('/api/signup', async (req, res) => {
    try {
        const { name, whatsappNumber, email, password } = req.body;

        if (!/^\d{10}$/.test(whatsappNumber)) {
            return res.status(400).json({ message: 'WhatsApp number must be 10 digits' });
        }

        const exists = await UserDetails.findOne({
            $or: [{ email }, { whatsappNumber }]
        });
        if (exists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await new UserDetails({
            name,
            whatsappNumber,
            email,
            password: hashedPassword
        }).save();

        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Signup failed' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    console.log('➡️ Login request:', req.body);
    try {
        const { identifier, password } = req.body;

        const user = await UserDetails.findOne({
            $or: [{ email: identifier }, { whatsappNumber: identifier }]
        });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({ token, user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Login error' });
    }
});

/* ================= FORGOT PASSWORD ================= */
app.post('/api/forgot-password', async (req, res) => {
    console.log('➡️ /api/forgot-password', req.body);
    try {
        const { email } = req.body;

        const user = await UserDetails.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'Email not registered' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000;
        await user.save();

        const resetUrl =
            `${process.env.FRONTEND_URL}/reset-password.html?token=${token}`;

        console.log('🔗 Reset URL:', resetUrl);

        await transporter.sendMail({
            from: `"Fest Support" <${process.env.EMAIL_FROM}>`,
            to: user.email,
            subject: 'Password Reset',
            html: `
                <h3>Password Reset</h3>
                <p>Click the link below to reset your password:</p>
                <a href="${resetUrl}">${resetUrl}</a>
                <p>This link is valid for 1 hour.</p>
            `
        });

        res.json({ message: 'Password reset email sent' });

    } catch (err) {
        console.error('❌ FORGOT PASSWORD ERROR:', err);
        res.status(500).json({ message: 'Failed to send reset email' });
    }
});

/* ================= RESET PASSWORD ================= */
app.post('/api/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        const user = await UserDetails.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired token' });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Reset failed' });
    }
});

/* ================= ITEMS ================= */
const storage = multer.diskStorage({
    destination: 'public/uploads/',
    filename: (req, file, cb) =>
        cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

app.get('/api/items', async (req, res) => {
    console.log('➡️ /api/items');
    try {
        const items = await Item.find().sort({ createdAt: 1 });
        res.json(items);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to load items' });
    }
});

/* ================= ADMIN ORDERS ================= */
app.get('/api/orders', async (req, res) => {
    console.log('➡️ Admin orders request');
    try {
        if (req.headers['x-admin-pin'] !== ADMIN_PIN) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const orders = await Order.find().sort({ createdAt: -1 });
        res.json(orders);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to load orders' });
    }
});

/* ================= SERVER ================= */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
    console.log(`🚀 Server running on port ${PORT}`)
);

