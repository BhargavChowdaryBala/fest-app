// Admin authentication middleware checking the 'x-admin-pin' header
const ADMIN_PIN = process.env.ADMIN_DASHBOARD_PASSWORD || "1234";

const adminAuth = (req, res, next) => {
    const pin = req.headers['x-admin-pin'];
    if (pin === ADMIN_PIN) {
        next(); // Authorization granted
    } else {
        res.status(401).json({ message: 'Unauthorized: Invalid Admin PIN' });
    }
};

export default adminAuth;
