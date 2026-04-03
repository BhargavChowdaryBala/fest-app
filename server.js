/**
 * SERVER.JS - The Core Backend Engine of the FestOrders Application
 * ---------------------------------------------------------------
 * This file is the primary entry point for the Node.js/Express server.
 * It handles:
 * 1. Database Connections (MongoDB)
 * 2. User Authentication (JWT, Bcrypt, Google OAuth2)
 * 3. Payment Processing (Razorpay Integration)
 * 4. Menu/Item Management (CRUD operations)
 * 5. Order Fulfillment & ID Verification
 * 6. Email Services (Nodemailer for password resets)
 */

require('dotenv').config(); // Load environment variables from .env file
const express = require('express'); // Web framework for Node.js
const path = require('path'); // Utility for working with file and directory paths
const fs = require('fs'); // File system module to handle physical files
const mongoose = require('mongoose'); // MongoDB object modeling tool
const cors = require('cors'); // Middleware to enable Cross-Origin Resource Sharing
const bcrypt = require('bcryptjs'); // Library to hash and salt passwords
const jwt = require('jsonwebtoken'); // Tool for creating and verifying JSON Web Tokens
const User = require('./models/User'); // Legacy User model
const Order = require('./models/Order'); // Order schema for tracking purchases
const UserDetails = require('./models/UserDetails'); // Main User schema for profiles
const Item = require('./models/Item'); // Schema for menu items/products
const nodemailer = require('nodemailer'); // Module to send emails
const crypto = require('crypto'); // Built-in Node module for cryptography/random strings
const Razorpay = require('razorpay'); // Official Razorpay SDK for dynamic payments
const { OAuth2Client } = require('google-auth-library'); // Google's library for OAuth2 verification
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID); // Initialize Google Identity client

/**
 * EMAIL TRANSPORTER CONFIGURATION
 * Uses Gmail SMTP to send automated emails (like password reset links).
 */
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // Use TLS
    auth: {
        user: process.env.EMAIL_USER, // Your Gmail address
        pass: process.env.EMAIL_PASS  // Your Gmail App Password
    },
    family: 4, // Force IPv4 to avoid connectivity issues on some networks
    logger: true,
    debug: true
});

/**
 * RAZORPAY INSTANCE
 * Initializes the payment gateway connection using API keys.
 */
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const app = express(); // Initialize the Express application

/**
 * GLOBAL MIDDLEWARE
 */
app.use(cors({
    origin: '*', // Allow all origins (standard for public-facing web apps)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], // Allowed HTTP methods
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-pin'] // Custom headers allowed
}));
app.use(express.json()); // Automatically parse incoming JSON data
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded data (needed for some callbacks)

// Custom middleware to handle and log JSON syntax errors gracefully
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        console.error('Bad JSON received:', err.message);
        return res.status(400).json({ message: 'Invalid JSON payload sent to server' });
    }
    next();
});

/**
 * CONFIG ENDPOINT
 * Provides public configuration (like Merchant Name and Client IDs) to the frontend safely.
 */
app.get('/api/config', (req, res) => {
    res.json({
        merchantName: process.env.MERCHANT_NAME,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID, 
        googleClientId: process.env.GOOGLE_CLIENT_ID
    });
});

/**
 * STATIC FILE SERVING
 * Serves the frontend folder ('public') and handles uploaded item images.
 */
const uploadsPath = path.join(__dirname, 'public/uploads');

// Ensure the local 'uploads' directory exists physically on the server
if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
}

// Health Check endpoint for monitoring services like UptimeRobot
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Serve the 'public' folder as a static website
app.use(express.static('public'));
// Serve uploaded images specifically under the /uploads URL
app.use('/uploads', express.static(uploadsPath));

// Load Admin PIN from environment (used for dashboard security)
const ADMIN_PIN = process.env.ADMIN_DASHBOARD_PASSWORD || "1234";

/**
 * ADMIN AUTH MIDDLEWARE
 * Checks the 'x-admin-pin' header to protect sensitive dashboard routes.
 */
const adminAuth = (req, res, next) => {
    const pin = req.headers['x-admin-pin'];
    if (pin === ADMIN_PIN) {
        next(); // Authorization granted
    } else {
        res.status(401).json({ message: 'Unauthorized: Invalid Admin PIN' });
    }
};

/**
 * USER AUTH MIDDLEWARE (JWT)
 * Verifies the Bearer token in the Authorization header for logged-in users.
 */
const userAuth = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1]; // Extract token from "Bearer <token>"
    if (!token) return res.status(401).json({ message: 'Access Denied: No Token Provided' });

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified; // Attach user ID to the request object
        next();
    } catch (err) {
        res.status(400).json({ message: 'Invalid Token' });
    }
};

/**
 * DATABASE CONNECTION
 * Establishes the persistent link to MongoDB.
 */
mongoose.connect(process.env.MONGO_URI, { dbName: 'fest_users' })
    .then(() => console.log('MongoDB Connected to fest_users'))
    .catch(err => console.log('MongoDB Connection Error:', err));

/**
 * AUTHENTICATION ROUTES
 */

// SIGNUP: Registers a new user with Name, WhatsApp, Email, and Password
app.post('/api/signup', async (req, res) => {
    try {
        const { name, whatsappNumber, email, password } = req.body;

        // Check if email is already taken
        const emailUser = await UserDetails.findOne({ email });
        if (emailUser) {
            return res.status(400).json({ message: 'User with this Email already exists' });
        }

        // Validate that WhatsApp number is provided for manual signups
        if (!whatsappNumber) {
            return res.status(400).json({ message: 'WhatsApp number is required' });
        }

        // Check if WhatsApp number is already registered
        const whatsappUser = await UserDetails.findOne({ whatsappNumber });
        if (whatsappUser) {
            return res.status(400).json({ message: 'User with this WhatsApp number already exists' });
        }

        // Ensure exactly 10 digits for mobile number
        if (!/^\d{10}$/.test(whatsappNumber)) {
            return res.status(400).json({ message: 'WhatsApp number must be 10 digits' });
        }

        // Hash the password for security
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Save new user to MongoDB
        const newUser = new UserDetails({
            name,
            whatsappNumber,
            email,
            password: hashedPassword
        });

        await newUser.save();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// LOGIN: Authenticates user by Email/WhatsApp and Password
app.post('/api/login', async (req, res) => {
    try {
        const { identifier, password } = req.body; // 'identifier' can be email or mobile

        // Search for user in the database
        let user = await UserDetails.findOne({
            $or: [{ whatsappNumber: identifier }, { email: identifier }]
        });

        // Fallback for legacy admin/test accounts
        if (!user) {
            const legacyUser = await User.findOne({ username: identifier });
            if (legacyUser) {
                const isMatch = await bcrypt.compare(password, legacyUser.password);
                if (isMatch) {
                    const token = jwt.sign({ id: legacyUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
                    return res.json({ token, user: { id: legacyUser._id, username: legacyUser.username } });
                }
            }
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Verify the password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Issue a JWT token valid for 1 hour
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.json({ 
            token, 
            user: { id: user._id, name: user.name, whatsappNumber: user.whatsappNumber, email: user.email } 
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// GOOGLE AUTH: Handles one-tap sign-in and auto-registration
app.post('/api/auth/google', async (req, res) => {
    try {
        const { credential } = req.body;

        // Verify the Google ID Token authenticity
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const { email, name, sub: googleId } = payload;

        // Check if user already exists
        let user = await UserDetails.findOne({ email });

        if (!user) {
            // Register a new user automatically with a random security password
            user = new UserDetails({
                name,
                email,
                password: await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10),
                googleId: googleId
            });
            await user.save();
        }

        // Log them in via JWT
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.json({
            token,
            user: { id: user._id, name: user.name, whatsappNumber: user.whatsappNumber, email: user.email }
        });

    } catch (error) {
        console.error('Google Auth Error:', error);
        res.status(401).json({ message: 'Google Authentication failed' });
    }
});

// CHANGE PASSWORD: Securely updates user password from their profile
app.post('/api/change-password', userAuth, async (req, res) => {
    try {
        const { newPassword } = req.body;
        const userId = req.user.id; // Extracted safely from JWT

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ message: 'Password too short' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await UserDetails.findByIdAndUpdate(userId, { password: hashedPassword });
        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// FORGOT PASSWORD: Generates a temporary reset token and link
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await UserDetails.findOne({ email });

        if (!user) return res.status(404).json({ message: 'Email not found' });

        // Create a secure 20-character random token
        const token = crypto.randomBytes(20).toString('hex');
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // Token expires in 1 hour

        await user.save();

        // Construct the unique reset URL
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');
        const resetUrl = `${protocol}://${host}/reset-password.html?token=${token}`;

        res.json({
            message: 'Reset link generated',
            email: user.email,
            resetUrl: resetUrl,
            useEmailJS: true
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// RESET PASSWORD: Finalizes the password reset using the unique token
app.post('/api/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        const user = await UserDetails.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() } // Must not be expired
        });

        if (!user) return res.status(400).json({ message: 'Invalid or expired token' });

        // Update with new hashed password and clear reset fields
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

/**
 * MENU / ITEMS API
 */

const multer = require('multer'); // File upload middleware
const storage = multer.memoryStorage(); // Store files in RAM temporarily
const upload = multer({ storage: storage });

// GET ITEMS: Fetch the entire menu
app.get('/api/items', async (req, res) => {
    try {
        const items = await Item.find().sort({ createdAt: 1 });
        res.json(items);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching items' });
    }
});

// POST ITEMS: Add a new dish/item to the menu (Admin only)
app.post('/api/items', adminAuth, upload.single('image'), async (req, res) => {
    try {
        const { name, price } = req.body;
        let imagePath = '';

        if (req.file) {
            // Convert uploaded binary image to Base64 URI string
            const b64 = Buffer.from(req.file.buffer).toString('base64');
            imagePath = `data:${req.file.mimetype};base64,${b64}`;
        }

        const newItem = new Item({ name, price, image: imagePath });
        await newItem.save();
        res.status(201).json(newItem);
    } catch (error) {
        res.status(500).json({ message: 'Error adding item' });
    }
});

// DELETE ITEM: Remove an item from the menu (Admin only)
app.delete('/api/items/:id', adminAuth, async (req, res) => {
    try {
        await Item.findByIdAndDelete(req.params.id);
        res.json({ message: 'Item deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting item' });
    }
});

// UPDATE ITEM: Modify item details like price (Admin only)
app.patch('/api/items/:id', adminAuth, async (req, res) => {
    try {
        const { price } = req.body;
        const result = await Item.findByIdAndUpdate(req.params.id, { price: Number(price) }, { new: true });
        if (!result) return res.status(404).json({ message: 'Item not found' });
        res.json({ message: 'Price updated successfully', item: result });
    } catch (error) {
        res.status(500).json({ message: 'Error updating price' });
    }
});

/**
 * ORDER & PAYMENT API
 */

// CREATE RAZORPAY ORDER: Initiates a payment session
app.post('/api/create-razorpay-order', async (req, res) => {
    try {
        const options = {
            amount: req.body.amount * 100, // INR in paise
            currency: 'INR',
            receipt: 'rx_' + Date.now()
        };
        const order = await razorpay.orders.create(options);
        res.json(order);
    } catch (error) {
        res.status(500).json({ message: 'Gateway error' });
    }
});

// VERIFY PAYMENT: Confirms Razorpay signature and saves order to DB
app.post('/api/verify-payment', async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, items, totalAmount, mobileNumber, email } = req.body;

        // Securely verify that the payment callback is genuinely from Razorpay
        const generated_signature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(razorpay_order_id + "|" + razorpay_payment_id)
            .digest('hex');

        if (generated_signature !== razorpay_signature) {
            return res.status(400).json({ message: 'Fraudulent payment detected' });
        }

        // Generate a human-readable unique order ID (e.g., FEST-1234)
        const uniqueId = 'FEST-' + Math.floor(1000 + Math.random() * 9000);

        const newOrder = new Order({
            uniqueId, items, totalAmount, mobileNumber, email, 
            transactionId: razorpay_payment_id, status: 'paid'
        });

        await newOrder.save();
        res.json({ message: 'Order created', uniqueId, order: newOrder });
    } catch (error) {
        res.status(500).json({ message: 'Verification error' });
    }
});

// MY ORDERS: Retrieves order history for a specific user
app.post('/api/my-orders', async (req, res) => {
    try {
        const { mobileNumber, email } = req.body;
        const orders = await Order.find({
            $or: [{ mobileNumber }, { email }]
        }).sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching history' });
    }
});

/**
 * ADMIN CONTROL API
 */

// GET ALL ORDERS: Fetch every order in the system (Admin only)
app.get('/api/orders', adminAuth, async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching orders' });
    }
});

// MARK USED: Validates a ticket and marks it as used (QR Verification)
app.post('/api/mark-used', adminAuth, async (req, res) => {
    try {
        const { uniqueId } = req.body;
        // Atomic update: only succeeds if current status is NOT 'used'
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
        res.status(500).json({ message: 'Error marking ID' });
    }
});

// CHECK ID: Publicly check the status of a specific Fest ID
app.post('/api/check-id', async (req, res) => {
    try {
        const { uniqueId } = req.body;
        const order = await Order.findOne({ uniqueId });
        if (!order) return res.status(404).json({ message: 'ID not found' });
        res.json({ status: order.status, order });
    } catch (error) {
        res.status(500).json({ message: 'Error checking ID' });
    }
});

// MANUAL ORDER: Create an order manually for cash payments (Admin only)
app.post('/api/manual-order', adminAuth, async (req, res) => {
    try {
        const { items, totalAmount, mobileNumber, email } = req.body;
        const uniqueId = 'FEST-' + Math.floor(1000 + Math.random() * 9000);
        const newOrder = new Order({
            uniqueId, items, totalAmount, mobileNumber, email,
            transactionId: 'MANUAL_PAYMENT', status: 'paid'
        });
        await newOrder.save();
        res.json({ message: 'Manual order created', uniqueId, order: newOrder });
    } catch (error) {
        res.status(500).json({ message: 'Error creating manual order' });
    }
});

/**
 * START SERVER
 */
const PORT = process.env.PORT || 3000; // Use environment PORT or default to 3000
app.listen(PORT, () => console.log(`Backend Server Live on Port ${PORT}`));
