# Fest App 🍔 – Event Food Ordering System

A premium, full-stack application designed to streamline food ordering during fests and events. Features secure user authentication, real-time payment integration, and a dedicated admin portal for order verification.

---

## 🚀 Key Highlights & Features

### 🔐 Secure User Authentication
- **JWT-Based Login/Signup**: Protects user accounts and orders.
- **Forgot Password Recovery**: Integrated with **EmailJS** for secure password reset links sent via Gmail.
- **Persistent Sessions**: Stay logged in across your browsing session.

### 💳 Seamless Payment Integration
- **Razorpay Checkout**: Support for UPI, Cards, and NetBanking.
- **Automatic Verification**: Real-time payment confirmation and instant order generation.
- **Secure Handling**: No sensitive banking data is stored on our servers.

### 🎟️ Unique "FEST-ID" & QR Generation
- **Automated Issuance**: Every successful order generates a unique `FEST-XXXX` ID.
- **QR Code Branding**: Orders are viewable as QR codes for quick scanning at the counter.

### 📊 Real-Time Admin Dashboard
- **PIN Protected**: Secure access for coordinators and admins.
- **Order Verification**: Scan QR codes to mark orders as "Used" instantly.
- **Menu Management**: Add or delete items (with image support) directly from the dashboard.
- **Analytics at a Glance**: Track total sales and pending orders in real-time.

### 📱 Mobile-First Experience
- **Responsive Design**: Fast and smooth UI optimized for mobile phones, perfect for busy event crowds.
- **Dynamic Feedback**: Real-time toasts and alerts for all actions.

---

## 🛠️ Step-by-Step Installation Guide

Follow these steps to get the application running on your local machine:

### 1. Clone the Repository
Open your terminal (PowerShell, CMD, or Terminal) and run:
```bash
git clone https://github.com/your-username/fest_application.git
```
*Note: Replace `your-username` with the actual GitHub username.*

### 2. Navigate to the Project Folder
Go into the `fest-app` directory:
```bash
cd fest_application/fest-app
```

### 3. Install Dependencies
Install all necessary packages using npm:
```bash
npm install
```

### 4. Configure Environment Variables
Create a file named `.env` inside the `fest-app` folder and add the following:

```env
# Database (MongoDB Atlas)
MONGO_URI=your_mongodb_connection_uri

# Authentication
JWT_SECRET=any_random_secure_string

# Email (Gmail App Password)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password

# Razorpay Keys
RAZORPAY_KEY_ID=rzp_test_xxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxx

# Admin PIN
ADMIN_DASHBOARD_PASSWORD=1234
```

### 5. Start the Application
Run the server:
```bash
node server.js
```
The app will be live at: **`http://localhost:3000`**

---

## 📂 Project Structure
- **/public**: All frontend files (HTML, CSS, JS, Images).
- **/models**: Mongoose database schemas (User, Item, Order).
- **server.js**: Core Express.js backend logic and API endpoints.

## 🤝 Support
For any issues or contributions, feel free to open a ticket or contact the developer.
