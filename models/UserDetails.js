const mongoose = require('mongoose');

const userDetailsSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    whatsappNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
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
