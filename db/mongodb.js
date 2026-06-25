const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI);

mongoose.connection.once('open', () => {
    console.log('MongoDB connected!');
});

mongoose.connection.on('error', (err) => {
    console.error('MongoDB Error:', err);
});

module.exports = mongoose;