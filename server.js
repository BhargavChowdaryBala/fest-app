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

// --- EMAIL CONFIGURATION ---
// IMPORTANT: EMAIL_PASS must be a Google "App Password", not your login password.
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Verify email connection on startup
transporter.verify((error, success) => {
    if (error) {
        console.log("Email Config Error:", error);
    } else {
        console.log("Email Server is ready to send messages");
    }
});

// Razorpay Instance
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Handle JSON Parse errors
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ message: 'Invalid JSON payload' });
    }
    next();
});

// --- STATIC FILES & DIRECTORIES ---
const uploadsPath = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use(express.static('public'));
app.use('/uploads', express.static(uploadsPath));

const ADMIN_PIN = process.env.ADMIN_DASHBOARD_PASSWORD || "1234";

// --- DATABASE ---
mongoose.connect(process.env.MONGO_URI, { dbName: 'fest_users' })
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.log('MongoDB Error:', err));

// --- MULTER FOR IMAGES ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

// --- ROUTES ---

// Config
app.get('/api/config', (req, res) => {
    res.json({
        merchantName: process.env.MERCHANT_NAME,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID
    });
});

// Signup
app.post('/api/signup', async (req, res) => {
    try {
        const { name, whatsappNumber, email, password } = req.body;
        const existingUser = await UserDetails.findOne({ $or: [{ whatsappNumber }, { email }] });
        if (existingUser) return res.status(400).json({ message: 'User already exists' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new UserDetails({ name, whatsappNumber, email, password: hashedPassword });
        await newUser.save();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        let user = await UserDetails.findOne({ $or: [{ whatsappNumber: identifier }, { email: identifier }] });

        if (!user) return res.status(400).json({ message: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// --- FORGOT PASSWORD (CORRECTED) ---
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await UserDetails.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'No account with that email address exists.' });
        }

        // Generate Token
        const token = crypto.randomBytes(20).toString('hex');
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        await user.save();

        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');
        const resetUrl = `${protocol}://${host}/reset-password.html?token=${token}`;

        const mailOptions = {
            from: `"Support" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: 'Password Reset Request',
            text: `You are receiving this because you requested a password reset.\n\n` +
                  `Please click the link below to complete the process:\n\n` +
                  `${resetUrl}\n\n` +
                  `If you did not request this, please ignore this email.`
        };

        // Use the promise-based sendMail
        await transporter.sendMail(mailOptions);
        res.json({ message: 'An e-mail has been sent to ' + user.email + ' with further instructions.' });

    } catch (error) {
        console.error('Forgot Password Error:', error);
        res.status(500).json({ message: 'Error in sending email', error: error.message });
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

        if (!user) {
            return res.status(400).json({ message: 'Password reset token is invalid or has expired.' });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.json({ message: 'Success! Your password has been changed.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// --- ITEMS & ORDERS ---

app.get('/api/items', async (req, res) => {
    try {
        const items = await Item.find().sort({ createdAt: 1 });
        res.json(items);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching items' });
    }
});

app.post('/api/items', upload.single('image'), async (req, res) => {
    try {
        const { name, price } = req.body;
        let imagePath = 'https://via.placeholder.com/500'; 
        if (req.file) imagePath = '/uploads/' + req.file.filename;

        const newItem = new Item({ name, price, image: imagePath });
        await newItem.save();
        res.status(201).json(newItem);
    } catch (error) {
        res.status(500).json({ message: 'Error adding item' });
    }
});

app.post('/api/mark-used', async (req, res) => {
    try {
        const { uniqueId } = req.body;
        const order = await Order.findOneAndUpdate(
            { uniqueId, status: { $ne: 'used' } },
            { status: 'used' },
            { new: true }
        );
        if (order) return res.json({ message: 'Verified Successfully', order });
        
        const existingOrder = await Order.findOne({ uniqueId });
        if (!existingOrder) return res.status(404).json({ message: 'ID not found' });
        res.status(400).json({ message: 'ALREADY USED!', order: existingOrder });
    } catch (error) {
        res.status(500).json({ message: 'Error' });
    }
});

// --- RAZORPAY ---

app.post('/api/create-razorpay-order', async (req, res) => {
    try {
        const options = {
            amount: req.body.amount * 100,
            currency: 'INR',
            receipt: 'rcpt_' + Date.now()
        };
        const order = await razorpay.orders.create(options);
        res.json(order);
    } catch (error) {
        res.status(500).json({ message: 'Razorpay Error' });
    }
});

app.post('/api/verify-payment', async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, items, totalAmount, mobileNumber, email } = req.body;
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(body.toString()).digest('hex');

        if (expectedSignature === razorpay_signature) {
            const uniqueId = 'FEST-' + Math.floor(1000 + Math.random() * 9000);
            const newOrder = new Order({ uniqueId, items, totalAmount, mobileNumber, email, transactionId: razorpay_payment_id, status: 'paid' });
            await newOrder.save();
            res.json({ message: 'Paid', uniqueId, order: newOrder });
        } else {
            res.status(400).json({ message: 'Invalid Signature' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Verification Error' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
