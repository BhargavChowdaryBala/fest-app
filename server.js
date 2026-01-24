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

/* 🔥 GLOBAL ERROR LOGGER */
app.use((err, req, res, next) => {
    console.error("❌ EXPRESS ERROR:", err);
    res.status(500).json({ message: 'Internal server error' });
});

/* ================= STATIC FILES ================= */
const uploadsPath = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use(express.static('public'));
app.use('/uploads', express.static(uploadsPath));

/* ================= DATABASE ================= */
mongoose.connect(process.env.MONGO_URI, { dbName: 'fest_users' })
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.error('❌ MongoDB error:', err));

/* ================= EMAIL (DEBUG ENABLED) ================= */
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

transporter.verify((err) => {
    if (err) {
        console.error('❌ EMAIL VERIFY FAILED:', err);
    } else {
        console.log('✅ Email transporter ready');
    }
});

/* ================= RAZORPAY ================= */
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const ADMIN_PIN = process.env.ADMIN_DASHBOARD_PASSWORD || "1234";

/* ================= AUTH ================= */
app.post('/api/login', async (req, res) => {
    console.log("➡️ Login request:", req.body);
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
    } catch (err) {
        console.error("❌ LOGIN ERROR:", err);
        res.status(500).json({ message: 'Login error' });
    }
});

/* ================= FORGOT PASSWORD (FULL DEBUG) ================= */
app.post('/api/forgot-password', async (req, res) => {
    console.log("➡️ Forgot password request:", req.body);

    try {
        const { email } = req.body;
        const user = await UserDetails.findOne({ email });

        if (!user) {
            console.log("❌ Email not found:", email);
            return res.status(404).json({ message: 'Email not registered' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000;
        await user.save();

        const resetUrl = `${process.env.FRONTEND_URL}/reset-password.html?token=${token}`;
        console.log("🔗 Reset URL:", resetUrl);

        await transporter.sendMail({
            from: `"Fest Support" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Reset Your Password',
            html: `
                <h3>Password Reset</h3>
                <p>Click below:</p>
                <a href="${resetUrl}">${resetUrl}</a>
                <p>Expires in 1 hour</p>
            `
        });

        console.log("✅ Reset email sent to:", email);
        res.json({ message: 'Reset link sent' });

    } catch (err) {
        console.error("❌ FORGOT PASSWORD ERROR:", err);
        res.status(500).json({ message: 'Email sending failed' });
    }
});

/* ================= RESET PASSWORD ================= */
app.post('/api/reset-password', async (req, res) => {
    console.log("➡️ Reset password request");

    try {
        const { token, newPassword } = req.body;
        const user = await UserDetails.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            console.log("❌ Invalid/expired token");
            return res.status(400).json({ message: 'Invalid token' });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        console.log("✅ Password reset success");
        res.json({ message: 'Password updated' });

    } catch (err) {
        console.error("❌ RESET ERROR:", err);
        res.status(500).json({ message: 'Reset failed' });
    }
});

/* ================= ADMIN ORDERS (RESTORED) ================= */
app.get('/api/orders', async (req, res) => {
    console.log("➡️ Admin orders request");

    try {
        const pin = req.headers['x-admin-pin'];
        if (pin !== ADMIN_PIN) {
            console.log("❌ Invalid admin PIN:", pin);
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const orders = await Order.find().sort({ createdAt: -1 });
        res.json(orders);

    } catch (err) {
        console.error("❌ ADMIN ORDERS ERROR:", err);
        res.status(500).json({ message: 'Failed to load orders' });
    }
});

/* ================= SERVER ================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));

