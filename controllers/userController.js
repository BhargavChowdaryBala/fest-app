import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import UserDetails from '../models/UserDetails.js';
import User from '../models/User.js';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// SIGNUP: Registers a new user with Name, WhatsApp, Email, and Password
const signupUser = async (req, res) => {
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
};

// LOGIN: Authenticates user by Email/WhatsApp and Password
const loginUser = async (req, res) => {
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
};

// GOOGLE AUTH: Handles one-tap sign-in and auto-registration
const googleAuth = async (req, res) => {
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
};

// CHANGE PASSWORD: Securely updates user password from their profile
const changePassword = async (req, res) => {
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
};

// FORGOT PASSWORD: Generates a temporary reset token and link
const forgotPassword = async (req, res) => {
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
};

// RESET PASSWORD: Finalizes the password reset using the unique token
const resetPassword = async (req, res) => {
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
};

export {
    signupUser,
    loginUser,
    googleAuth,
    changePassword,
    forgotPassword,
    resetPassword
};
