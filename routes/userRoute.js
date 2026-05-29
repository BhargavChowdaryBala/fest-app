import express from 'express';
import {
    signupUser,
    loginUser,
    googleAuth,
    changePassword,
    forgotPassword,
    resetPassword
} from '../controllers/userController.js';
import userAuth from '../middleware/userAuth.js';

const userRoute = express.Router();

userRoute.post('/signup', signupUser);
userRoute.post('/login', loginUser);
userRoute.post('/auth/google', googleAuth);
userRoute.post('/change-password', userAuth, changePassword);
userRoute.post('/forgot-password', forgotPassword);
userRoute.post('/reset-password', resetPassword);

export default userRoute;
