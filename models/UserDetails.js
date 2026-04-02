const mongoose = require('mongoose');

const userDetailsSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    whatsappNumber: {
        type: String,
        required: false, // Optional for Google users
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true // Allows multiple null/undefined values
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date
}, {
    timestamps: true,
    collection: 'user_details'
});

module.exports = mongoose.model('UserDetails', userDetailsSchema);
