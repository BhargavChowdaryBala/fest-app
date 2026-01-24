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

/* ================= STATIC ================= */
const uploadsPath = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });
app.use(express.static('public'));
app.use('/uploads', express.static(uploadsPath));

/* ================= DATABASE ================= */
mongoose.connect(process.env.MONGO_URI, { dbName: 'fest_users' })
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.error('❌ MongoDB error:', err));

/* ================= EMAIL ================= */
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

transporter.verify(err => {
    if (err) console.error('❌ Email error:', err);
    else console.log('✅ Email ready');
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
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Failed to load items' });
    }
});

/* ================= AUTH ================= */
app.post('/api/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        const user = await UserDetails.findOne({
            $or: [{ email: identifier }, { whatsappNumber: identifier }]
        });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ token, user });
    } catch (e) {
        res.status(500).json({ message: 'Login failed' });
    }
});

/* ================= FORGOT PASSWORD ================= */
app.post('/api/forgot-password', async (req, res) => {
    console.log('➡️ /api/forgot-password', req.body);

    try {
        const user = await UserDetails.findOne({ email: req.body.email });
        if (!user) return res.status(404).json({ message: 'Email not registered' });

        const token = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000;
        await user.save();

        const resetUrl = `${process.env.FRONTEND_URL}/reset-password.html?token=${token}`;

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: 'Password Reset',
            html: `<a href="${resetUrl}">Reset Password</a>`
        });

        res.json({ message: 'Reset link sent' });

    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Email failed' });
    }
});

/* ================= ADMIN ORDERS ================= */
app.get('/api/orders', async (req, res) => {
    try {
        if (req.headers['x-admin-pin'] !== ADMIN_PIN) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        const orders = await Order.find().sort({ createdAt: -1 });
        res.json(orders);
    } catch (e) {
        res.status(500).json({ message: 'Failed to load orders' });
    }
});

/* ================= SERVER ================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));
