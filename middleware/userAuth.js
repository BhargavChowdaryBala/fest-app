import jwt from 'jsonwebtoken';

// User authentication middleware (JWT)
const userAuth = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1]; // Extract token from "Bearer <token>"
    if (!token) return res.status(401).json({ message: 'Access Denied: No Token Provided' });

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified; // Attach user ID to the request object
        next();
    } catch (err) {
        res.status(400).json({ message: 'Invalid Token' });
    }
};

export default userAuth;
