import Item from '../models/Item.js';

// GET ITEMS: Fetch the entire menu
const getItems = async (req, res) => {
    try {
        const items = await Item.find().sort({ createdAt: 1 });
        res.json(items);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching items' });
    }
};

// POST ITEMS: Add a new dish/item to the menu
const addItem = async (req, res) => {
    try {
        const { name, price } = req.body;
        let imagePath = '';

        if (req.file) {
            // Convert uploaded binary image to Base64 URI string
            const b64 = Buffer.from(req.file.buffer).toString('base64');
            imagePath = `data:${req.file.mimetype};base64,${b64}`;
        }

        const newItem = new Item({ name, price, image: imagePath });
        await newItem.save();
        res.status(201).json(newItem);
    } catch (error) {
        res.status(500).json({ message: 'Error adding item' });
    }
};

// DELETE ITEM: Remove an item from the menu
const deleteItem = async (req, res) => {
    try {
        await Item.findByIdAndDelete(req.params.id);
        res.json({ message: 'Item deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting item' });
    }
};

// UPDATE ITEM: Modify item details like price
const updateItemPrice = async (req, res) => {
    try {
        const { price } = req.body;
        const result = await Item.findByIdAndUpdate(req.params.id, { price: Number(price) }, { new: true });
        if (!result) return res.status(404).json({ message: 'Item not found' });
        res.json({ message: 'Price updated successfully', item: result });
    } catch (error) {
        res.status(500).json({ message: 'Error updating price' });
    }
};

export {
    getItems,
    addItem,
    deleteItem,
    updateItemPrice
};
