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

/* ===================== MIDDLEWARE ===================== */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ message: 'Invalid JSON payload' });
    }
    next();
});

/* ===================== STATIC FILES ===================== */
const uploadsPath = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
}

app.use(express.static('public'));
app.use('/uploads', express.static(uploadsPath));

/* ===================== DATABASE ===================== */
mongoose.connect(process.env.MONGO_URI, { dbName: 'fest_users' })
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error('❌ MongoDB Error:', err));

/* ===================== EMAIL (FIXED) ===================== */
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // Gmail App Password
    },
    tls: { rejectUnauthorized: false }
});

transporter.verify((err) => {
    if (err) console.error("❌ Email Error:", err);
    else console.log("✅ Email transporter ready");
});

/* ===================== RAZORPAY ===================== */
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

/* ===================== CONFIG API ===================== */
app.get('/api/config', (req, res) => {
    res.json({
        merchantName: process.env.MERCHANT_NAME,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID
    });
});

/* ===================== AUTH ===================== */
// Signup
app.post('/api/signup', async (req, res) => {
    try {
        const { name, whatsappNumber, email, password } = req.body;

        if (!/^\d{10}$/.test(whatsappNumber)) {
            return res.status(400).json({ message: 'WhatsApp number must be 10 digits' });
        }

        const exists = await UserDetails.findOne({ $or: [{ email }, { whatsappNumber }] });
        if (exists) return res.status(400).json({ message: 'User already exists' });

        const hashed = await bcrypt.hash(password, 10);

        await new UserDetails({
            name,
            whatsappNumber,
            email,
            password: hashed
        }).save();

        res.status(201).json({ message: 'User registered successfully' });
    } catch (e) {
        res.status(500).json({ message: 'Signup error', error: e.message });
    }
});

// Login
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
        res.status(500).json({ message: 'Login error' });
    }
});

/* ===================== FORGOT PASSWORD (FIXED) ===================== */
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await UserDetails.findOne({ email });

        if (!user) return res.status(404).json({ message: 'User not found' });

        const token = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000;
        await user.save();

        const resetUrl = `${process.env.FRONTEND_URL}/reset-password.html?token=${token}`;

        await transporter.sendMail({
            from: `"Fest Support" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Password Reset',
            html: `
                <h3>Password Reset</h3>
                <p>Click below to reset your password</p>
                <a href="${resetUrl}">Reset Password</a>
                <p>Valid for 1 hour</p>
            `
        });

        res.json({ message: 'Password reset email sent' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Email sending failed' });
    }
});

// Reset Password
app.post('/api/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        const user = await UserDetails.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) return res.status(400).json({ message: 'Invalid or expired token' });

        user.password = await bcrypt.hash(newPassword, 10);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.json({ message: 'Password reset successful' });
    } catch (e) {
        res.status(500).json({ message: 'Reset failed' });
    }
});

/* ===================== ITEMS ===================== */
const storage = multer.diskStorage({
    destination: 'public/uploads/',
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

app.get('/api/items', async (req, res) => {
    res.json(await Item.find());
});

app.post('/api/items', upload.single('image'), async (req, res) => {
    const image = req.file ? `/uploads/${req.file.filename}` : '';
    const item = await new Item({ ...req.body, image }).save();
    res.status(201).json(item);
});

/* ===================== ORDERS ===================== */
app.post('/api/create-razorpay-order', async (req, res) => {
    const order = await razorpay.orders.create({
        amount: req.body.amount * 100,
        currency: 'INR',
        receipt: 'fest_' + Date.now()
    });
    res.json(order);
});

app.post('/api/verify-payment', async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const sign = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

    if (sign !== razorpay_signature) {
        return res.status(400).json({ message: 'Payment verification failed' });
    }

    const uniqueId = 'FEST-' + Math.floor(1000 + Math.random() * 9000);
    const order = await new Order({ ...req.body, uniqueId }).save();

    res.json({ message: 'Payment successful', uniqueId });
});

/* ===================== SERVER ===================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
