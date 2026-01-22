require('dotenv').config();
const express = require('express');
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

// Email Transporter Configuration
const transporter = nodemailer.createTransport({
    service: 'gmail', // or your preferred service
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Required for PhonePe Callback
// Handle JSON Parse errors
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        console.error('Bad JSON received:', err.message);
        return res.status(400).json({ message: 'Invalid JSON payload sent to server' });
    }
    next();
});

// Config Endpoint
app.get('/api/config', (req, res) => {
    res.json({
        upiId: process.env.UPI_ID,
        merchantName: process.env.MERCHANT_NAME
    });
});

app.use(express.static('public')); // Serve frontend files

const ADMIN_PIN = "1234"; // Simple PIN for demonstration

// Database Connection
mongoose.connect(process.env.MONGO_URI, { dbName: 'fest_users' })
    .then(() => console.log('MongoDB Connected to fest_users'))
    .catch(err => console.log('MongoDB Connection Error:', err));

// Routes


// Login
// Signup
app.post('/api/signup', async (req, res) => {
    try {
        const { name, whatsappNumber, email, password } = req.body;

        // Check if user exists
        const existingUser = await UserDetails.findOne({
            $or: [{ whatsappNumber }, { email }]
        });

        if (existingUser) {
            return res.status(400).json({ message: 'User with this WhatsApp or Email already exists' });
        }

        // Validate Mobile Number
        if (!/^\d{10}$/.test(whatsappNumber)) {
            return res.status(400).json({ message: 'WhatsApp number must be exactly 10 digits' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

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

// Login (Enhanced)
app.post('/api/login', async (req, res) => {
    try {
        const { identifier, password } = req.body; // identifier can be whatsapp or email

        // Check user in user_details
        let user = await UserDetails.findOne({
            $or: [{ whatsappNumber: identifier }, { email: identifier }]
        });

        // Fallback to legacy User model (optional, if you want to keep 'john_doe' working)
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

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Create token
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.json({ token, user: { id: user._id, name: user.name, whatsappNumber: user.whatsappNumber, email: user.email } });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Forgot Password
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await UserDetails.findOne({ email });

        if (!user) {
            // Check if it is a legacy user (from User model)
            const legacyUser = await User.findOne({ username: email }); // Assuming username might be treated as identifier
            if (legacyUser) {
                return res.status(400).json({ message: 'Legacy account without email. Please contact admin to reset password.' });
            }
            return res.status(404).json({ message: 'User with this email does not exist' });
        }

        // Generate Token
        const token = crypto.randomBytes(20).toString('hex');

        // Set token and expiry (1 hour)
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

        await user.save();

        // Send Email
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');
        const resetUrl = `${protocol}://${host}/reset-password.html?token=${token}`;
        console.log('--- PASSWORD RESET DEBUG ---');
        console.log(`Reset Link for ${user.email}: ${resetUrl}`);
        console.log('----------------------------');

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: 'Password Reset Request',
            text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n` +
                `Please click on the following link, or paste this into your browser to complete the process:\n\n` +
                `${resetUrl}\n\n` +
                `If you did not request this, please ignore this email and your password will remain unchanged.\n`
        };

        transporter.sendMail(mailOptions, (err, response) => {
            if (err) {
                console.error('Email Error:', err);
                return res.status(500).json({ message: 'Error sending email' });
            }
            res.json({ message: 'Password reset email sent' });
        });

    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
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
            return res.status(400).json({ message: 'Password reset token is invalid or has expired' });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();

        res.json({ message: 'Password has been updated' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Generate Fest ID (Legacy or Internal)
app.post('/api/generate-id', async (req, res) => {
    try {
        const { items, totalAmount, mobileNumber, email, transactionId } = req.body;

        // Generate a short unique ID (e.g., FEST-1234)
        const uniqueId = 'FEST-' + Math.floor(1000 + Math.random() * 9000);

        const newOrder = new Order({
            uniqueId,
            items,
            totalAmount,
            mobileNumber,
            email,
            transactionId
        });

        await newOrder.save();
        res.json({ uniqueId });
    } catch (error) {
        res.status(500).json({ message: 'Error generating ID', error: error.message });
    }
});




// --- ITEMS API ---

const path = require('path');
const multer = require('multer');

// Configure Multer Storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)) // Append extension
    }
});

const upload = multer({ storage: storage });

// Ensure upload directory exists (optional safety check, but 'public/uploads' should exist or be created)
const fs = require('fs');
const uploadDir = 'public/uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Get All Items
app.get('/api/items', async (req, res) => {
    try {
        const items = await Item.find().sort({ createdAt: 1 });
        res.json(items);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching items', error: error.message });
    }
});

// Add New Item (Admin) - with Image Upload
app.post('/api/items', upload.single('image'), async (req, res) => {
    try {
        const { name, price } = req.body;
        // req.file is the `image` file
        // req.body will hold the text fields, if there were any

        if (!name || price === undefined) {
            return res.status(400).json({ message: 'Name and price are required' });
        }

        let imagePath = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3'; // Default
        if (req.file) {
            imagePath = '/uploads/' + req.file.filename;
        }

        const newItem = new Item({
            name,
            price,
            image: imagePath,
            description: 'Tasty and delicious!' // Default description or could be added to form later
        });

        await newItem.save();

        res.status(201).json(newItem);
    } catch (error) {
        console.error("Error adding item:", error); // Log for debugging
        res.status(500).json({ message: 'Error adding item', error: error.message });
    }
});

// Delete Item (Admin)
app.delete('/api/items/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await Item.findByIdAndDelete(id);

        if (!result) {
            return res.status(404).json({ message: 'Item not found' });
        }

        res.json({ message: 'Item deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting item', error: error.message });
    }
});

// Check Fest ID
app.post('/api/check-id', async (req, res) => {
    try {
        const { uniqueId } = req.body;
        const order = await Order.findOne({ uniqueId });

        if (!order) {
            return res.status(404).json({ message: 'ID not found' });
        }

        res.json({ status: order.status, order });
    } catch (error) {
        res.status(500).json({ message: 'Error checking ID', error: error.message });
    }
});

// Get User Orders
app.post('/api/my-orders', async (req, res) => {
    try {
        const { mobileNumber, email } = req.body;

        if (!mobileNumber && !email) {
            return res.status(400).json({ message: 'User identifier required' });
        }

        const query = {
            $or: []
        };

        if (mobileNumber && mobileNumber !== '-') query.$or.push({ mobileNumber });
        if (email && email !== '-') query.$or.push({ email });

        if (query.$or.length === 0) {
            return res.json([]); // No valid identifiers
        }

        const orders = await Order.find(query).sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching orders', error: error.message });
    }
});

// Get All Orders (Admin)
app.get('/api/orders', async (req, res) => {
    try {
        const adminPin = req.headers['x-admin-pin'];
        if (adminPin !== ADMIN_PIN) {
            return res.status(401).json({ message: 'Unauthorized: Invalid Admin PIN' });
        }

        const orders = await Order.find().sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching orders', error: error.message });
    }
});

// Mark Fest ID as Used
app.post('/api/mark-used', async (req, res) => {
    try {
        const { uniqueId } = req.body;

        // Atomic check and update: Only update if status is NOT 'used'
        const order = await Order.findOneAndUpdate(
            { uniqueId, status: { $ne: 'used' } },
            { status: 'used' },
            { new: true }
        );

        if (order) {
            return res.json({ message: 'Verified Successfully', order });
        }

        // If update failed, check why (Already used vs Not found)
        const existingOrder = await Order.findOne({ uniqueId });

        if (!existingOrder) {
            return res.status(404).json({ message: 'ID not found' });
        } else {
            // Found but was not updated -> meant it was already 'used'
            return res.status(400).json({ message: 'ALREADY USED!', order: existingOrder });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error marking ID', error: error.message });
    }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
