import crypto from 'crypto';
import Razorpay from 'razorpay';
import Order from '../models/Order.js';

// RAZORPAY INSTANCE
// Initializes the payment gateway connection using API keys.
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'dummy_id',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret'
});

// CREATE RAZORPAY ORDER: Initiates a payment session
const createRazorpayOrder = async (req, res) => {
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
};

// VERIFY PAYMENT: Confirms Razorpay signature and saves order to DB
const verifyPayment = async (req, res) => {
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
};

// MY ORDERS: Retrieves order history for a specific user
const getMyOrders = async (req, res) => {
    try {
        const { mobileNumber, email } = req.body;
        const orders = await Order.find({
            $or: [{ mobileNumber }, { email }]
        }).sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching history' });
    }
};

// GET ALL ORDERS: Fetch every order in the system (Admin only)
const getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching orders' });
    }
};

// MARK USED: Validates a ticket and marks it as used (QR Verification) (Admin only)
const markOrderUsed = async (req, res) => {
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
};

// CHECK ID: Publicly check the status of a specific Fest ID
const checkId = async (req, res) => {
    try {
        const { uniqueId } = req.body;
        const order = await Order.findOne({ uniqueId });
        if (!order) return res.status(404).json({ message: 'ID not found' });
        res.json({ status: order.status, order });
    } catch (error) {
        res.status(500).json({ message: 'Error checking ID' });
    }
};

// MANUAL ORDER: Create an order manually for cash payments (Admin only)
const createManualOrder = async (req, res) => {
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
};

export {
    createRazorpayOrder,
    verifyPayment,
    getMyOrders,
    getAllOrders,
    markOrderUsed,
    checkId,
    createManualOrder
};
