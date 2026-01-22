require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const UserDetails = require('./models/UserDetails');

async function checkUsers() {
    try {
        await mongoose.connect(process.env.MONGO_URI, { dbName: 'fest_users' });
        console.log('Connected to DB');

        const legacyUsers = await User.find({});
        const newUsers = await UserDetails.find({});

        console.log(`Legacy Users (User model): ${legacyUsers.length}`);
        legacyUsers.forEach(u => console.log(` - ${u.username}`));

        console.log(`New Users (UserDetails model): ${newUsers.length}`);
        newUsers.forEach(u => console.log(` - ${u.name} (${u.email})`));

        mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

checkUsers();
