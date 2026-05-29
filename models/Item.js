/**
 * ITEM MODEL - Schema for Menu Products
 * Defines the structure for items in the catalog (Name, Price, Image, etc).
 */
import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    image: {
        type: String,
        default: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3'
    },
    description: {
        type: String,
        default: 'Tasty and delicious!'
    }
}, { timestamps: true });

export default mongoose.model('Item', itemSchema);
