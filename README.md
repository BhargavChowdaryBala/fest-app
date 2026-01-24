# Fest App 🍔

A full-stack food ordering application for fests and events. Features QR-code ticket generation, admin dashboard, and Razorpay payment integration.

## Features
- **User:** Browse menu, add to cart, pay via Razorpay (UPI/Card), generate unique QR Order Ticket.
- **Admin:** Dashboard to view stats, manage menu items, scan QR tickets to mark orders as "Used".
- **Security:** Admin PIN protection, secure payment verification.

## Prerequisites
- Node.js installed
- MongoDB (Atlas or Local)
- Razorpay Account (for API Keys)

## Setup Guide

### 1. Install Dependencies
Open your terminal in the project folder and run:
```bash
npm install
```

### 2. Configure Environment Variables
Create a new file named `.env` in the root directory and add the following keys:

```env
# Database
MONGO_URI=your_mongodb_connection_string

# Authentication
JWT_SECRET=somesecretkey123

# Email (for Forgot Password)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Admin Settings
ADMIN_DASHBOARD_PASSWORD=your_secure_pin

# Razorpay Payment Gateway
MERCHANT_NAME=MyFestName
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

### 3. Run the Server
Start the application:
```bash
node server.js
```
The server will start on `http://localhost:3000`.

## Usage
- **Customer View:** Open `http://localhost:3000/hi.html` on your mobile or desktop.
- **Admin Dashboard:** Open `http://localhost:3000/admin.html`. Use the PIN configured in `.env`.

## Deployment
See [DEPLOYMENT.md](DEPLOYMENT.md) for instructions on how to deploy to Render and Vercel.
