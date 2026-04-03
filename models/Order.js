/**
 * ORDER MODEL - Schema for Customer Purchases
 * Tracks unique order IDs, transaction IDs, status, and purchased items.
 */
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    uniqueId: {
        type: String,
        required: true,
        unique: true
    },
    status: {
        type: String,
        enum: ['unused', 'used', 'paid'],
        default: 'unused'
    },
    items: [{
        name: String,
        price: Number
    }],
    totalAmount: Number,
    mobileNumber: String,
    email: String,
    transactionId: {
        type: String,
        default: 'NOT_PROVIDED'
    }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
