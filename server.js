require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const multer = require('multer');
const path = require('path');

// Models
const User = require('./models/User');
const Order = require('./models/Order');
const UserDetails = require('./models/UserDetails');
const Item = require('./models/Item');

const app = express();

/* =========================
   MIDDLEWARE
========================= */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   EMAIL (ORIGINAL)
========================= */
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

/* =========================
   RAZORPAY
========================= */
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

/* =========================
   STATIC FILES
========================= */
app.use(express.static('public'));

/* =========================
   CONFIG API
========================= */
app.get('/api/config', (req, res) => {
    res.json({
        merchantName: process.env.MERCHANT_NAME,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID
    });
});

/* =========================
   DATABASE
========================= */
mongoose.connect(process.env.MONGO_URI, { dbName: 'fest_users' })
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.error('MongoDB Error:', err));

const ADMIN_PIN = process.env.ADMIN_DASHBOARD_PASSWORD || "1234";

/* =========================
   AUTH
========================= */
app.post('/api/signup', async (req, res) => {
    try {
        const { name, whatsappNumber, email, password } = req.body;

        const exists = await UserDetails.findOne({
            $or: [{ whatsappNumber }, { email }]
        });

        if (exists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashed = await bcrypt.hash(password, 10);
        await UserDetails.create({ name, whatsappNumber, email, password: hashed });

        res.status(201).json({ message: 'Signup successful' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;

        const user = await UserDetails.findOne({
            $or: [{ whatsappNumber: identifier }, { email: identifier }]
        });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ token, user });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/* =========================
   FORGOT PASSWORD (ROLLED BACK)
========================= */
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await UserDetails.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const token = crypto.randomBytes(20).toString('hex');
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000;
        await user.save();

        const resetUrl = `${req.protocol}://${req.get('host')}/reset-password.html?token=${token}`;

        transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: 'Password Reset',
            text: resetUrl
        });

        res.json({ message: 'Reset email sent' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/* =========================
   ITEMS (ORIGINAL)
========================= */
const storage = multer.diskStorage({
    destination: 'public/uploads',
    filename: (_, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

app.get('/api/items', async (_, res) => {
    const items = await Item.find().sort({ createdAt: 1 });
    res.json(items);
});

app.post('/api/items', upload.single('image'), async (req, res) => {
    const image = req.file ? `/uploads/${req.file.filename}` : '';
    const item = await Item.create({
        name: req.body.name,
        price: req.body.price,
        image,
        description: 'Tasty and delicious!'
    });
    res.status(201).json(item);
});

/* =========================
   SERVER
========================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
