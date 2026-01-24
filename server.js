require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const UserDetails = require('./models/UserDetails');
const Item = require('./models/Item');
const Order = require('./models/Order');

const app = express();

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());

/* ================= DATABASE ================= */
mongoose.connect(process.env.MONGO_URI, { dbName: 'fest_users' })
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

/* ================= EMAIL (GMAIL SMTP) ================= */
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // APP PASSWORD
  },
});

transporter.verify(err => {
  if (err) console.error("❌ Email error:", err);
  else console.log("✅ Email transporter ready");
});

/* ================= CONFIG ================= */
app.get('/api/config', (req, res) => {
  res.json({ status: 'ok' });
});

/* ================= FORGOT PASSWORD ================= */
app.post('/api/forgot-password', async (req, res) => {
  console.log("➡️ /api/forgot-password", req.body);

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

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password.html?token=${token}`;
    console.log("🔗 Reset URL:", resetUrl);

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset',
      text: `Reset your password: ${resetUrl}`,
    });

    res.json({ message: 'Reset link sent to email' });

  } catch (err) {
    console.error("❌ Forgot password error:", err);
    res.status(500).json({ message: 'Email failed' });
  }
});

/* ================= ITEMS ================= */
app.get('/api/items', async (req, res) => {
  res.json(await Item.find());
});

/* ================= ADMIN ORDERS ================= */
app.get('/api/orders', async (req, res) => {
  res.json(await Order.find());
});

/* ================= SERVER ================= */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);


