require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Order = require('./models/Order');
const UserDetails = require('./models/UserDetails');
const Item = require('./models/Item');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const multer = require('multer');

const app = express();

// --- 1. ROBUST EMAIL CONFIG ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS // MUST be a 16-character App Password
    },
    tls: {
        rejectUnauthorized: false // Helps bypass some cloud network restrictions
    }
});

// Verification check for Render logs
transporter.verify((error, success) => {
    if (error) {
        console.error("SMTP Connection Error:", error);
    } else {
        console.log("SMTP Server is ready to send emails");
    }
});

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// --- 2. MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- 3. UPLOADS CONFIG ---
const uploadsPath = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use(express.static('public'));
app.use('/uploads', express.static(uploadsPath));

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

const ADMIN_PIN = process.env.ADMIN_DASHBOARD_PASSWORD || "1234";

// --- 4. DATABASE ---
mongoose.connect(process.env.MONGO_URI, { dbName: 'fest_users' })
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.log('MongoDB Connection Error:', err));

// --- 5. UPDATED FORGOT PASSWORD ROUTE ---
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await UserDetails.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User with this email does not exist' });
        }

        const token = crypto.randomBytes(20).toString('hex');
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; 
        await user.save();

        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');
        // This creates the correct URL regardless of localhost or Render domain
        const resetUrl = `${protocol}://${host}/reset-password.html?token=${token}`;

        const mailOptions = {
            from: `"Fest Support" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: 'Password Reset Request',
            text: `Click the link below to reset your password. It expires in 1 hour:\n\n${resetUrl}\n\nIf you did not request this, please ignore this email.`
        };

        // CRITICAL CHANGE: Using the promise-based await to ensure it finishes or fails explicitly
        await transporter.sendMail(mailOptions);
        
        // Return response only AFTER email is sent
        return res.status(200).json({ message: 'Password reset email sent successfully' });

    } catch (error) {
        console.error('Email Send Failure:', error);
        return res.status(500).json({ 
            message: 'Failed to send email. Check server logs.', 
            error: error.message 
        });
    }
});

// --- 6. RESET PASSWORD ---
app.post('/api/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        const user = await UserDetails.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Token is invalid or expired' });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// --- 7. OTHER ENDPOINTS (REMAINING SAME) ---
app.get('/api/config', (req, res) => {
    res.json({ merchantName: process.env.MERCHANT_NAME, razorpayKeyId: process.env.RAZORPAY_KEY_ID });
});

app.post('/api/signup', async (req, res) => {
    try {
        const { name, whatsappNumber, email, password } = req.body;
        const existingUser = await UserDetails.findOne({ $or: [{ whatsappNumber }, { email }] });
        if (existingUser) return res.status(400).json({ message: 'User already exists' });
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const newUser = new UserDetails({ name, whatsappNumber, email, password: hashedPassword });
        await newUser.save();
        res.status(201).json({ message: 'Registered' });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.post('/api/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        const user = await UserDetails.findOne({ $or: [{ whatsappNumber: identifier }, { email: identifier }] });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.get('/api/items', async (req, res) => {
    const items = await Item.find().sort({ createdAt: 1 });
    res.json(items);
});

app.post('/api/items', upload.single('image'), async (req, res) => {
    const { name, price } = req.body;
    const newItem = new Item({ name, price, image: req.file ? `/uploads/${req.file.filename}` : 'https://via.placeholder.com/150' });
    await newItem.save();
    res.status(201).json(newItem);
});

app.post('/api/create-razorpay-order', async (req, res) => {
    const order = await razorpay.orders.create({ amount: req.body.amount * 100, currency: 'INR', receipt: 'r_' + Date.now() });
    res.json(order);
});

app.post('/api/verify-payment', async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, items, totalAmount, mobileNumber, email } = req.body;
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(razorpay_order_id + "|" + razorpay_payment_id).digest('hex');
    if (expected === razorpay_signature) {
        const uniqueId = 'FEST-' + Math.floor(1000 + Math.random() * 9000);
        const order = new Order({ uniqueId, items, totalAmount, mobileNumber, email, transactionId: razorpay_payment_id, status: 'paid' });
        await order.save();
        res.json({ message: 'Success', uniqueId });
    } else { res.status(400).json({ message: 'Invalid' }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
