import express from 'express';
import {
    createRazorpayOrder,
    verifyPayment,
    getMyOrders,
    getAllOrders,
    markOrderUsed,
    checkId,
    createManualOrder
} from '../controllers/orderController.js';
import adminAuth from '../middleware/adminAuth.js';

const orderRoute = express.Router();

orderRoute.post('/create-razorpay-order', createRazorpayOrder);
orderRoute.post('/verify-payment', verifyPayment);
orderRoute.post('/my-orders', getMyOrders);
orderRoute.get('/orders', adminAuth, getAllOrders);
orderRoute.post('/mark-used', adminAuth, markOrderUsed);
orderRoute.post('/check-id', checkId);
orderRoute.post('/manual-order', adminAuth, createManualOrder);

export default orderRoute;
