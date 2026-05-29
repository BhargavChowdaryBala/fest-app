import express from 'express';
import multer from 'multer';
import {
    getItems,
    addItem,
    deleteItem,
    updateItemPrice
} from '../controllers/itemController.js';
import adminAuth from '../middleware/adminAuth.js';

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const itemRoute = express.Router();

itemRoute.get('/', getItems);
itemRoute.post('/', adminAuth, upload.single('image'), addItem);
itemRoute.delete('/:id', adminAuth, deleteItem);
itemRoute.patch('/:id', adminAuth, updateItemPrice);

export default itemRoute;
