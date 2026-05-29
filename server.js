/**
 * SERVER.JS - The Core Backend Engine of the FestOrders Application
 * ---------------------------------------------------------------
 * This file is the primary entry point for the Node.js/Express server.
 * It connects to MongoDB, registers global middleware, serving static resources,
 * and mounts modular API routes.
 */

import 'dotenv/config'; // Load environment variables from .env file
import express from 'express'; // Web framework for Node.js
import path from 'path'; // Utility for working with file and directory paths
import fs from 'fs'; // File system module to handle physical files
import cors from 'cors'; // Middleware to enable Cross-Origin Resource Sharing
import { fileURLToPath } from 'url';

import connectDB from './config/db.js'; // Database connection configuration
import userRoute from './routes/userRoute.js'; // User routes
import itemRoute from './routes/itemRoute.js'; // Item routes
import orderRoute from './routes/orderRoute.js'; // Order routes

// Resolve __dirname since it is not defined in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express(); // Initialize the Express application

// Connect to MongoDB
connectDB();

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

// Health Check endpoint for monitoring services like UptimeRobot
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
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

// Serve the 'public' folder as a static website
app.use(express.static('public'));
// Serve uploaded images specifically under the /uploads URL
app.use('/uploads', express.static(uploadsPath));

/**
 * API ROUTES ROUTER MOUNTING
 */
app.use('/api', userRoute);
app.use('/api/items', itemRoute);
app.use('/api', orderRoute);

/**
 * START SERVER
 */
const PORT = process.env.PORT || 3000; // Use environment PORT or default to 3000
app.listen(PORT, () => console.log(`Backend Server Live on Port ${PORT}`));
