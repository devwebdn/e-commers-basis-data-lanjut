const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    id: Number,
    name: String,
    description: String,
    price: Number,
    stok: Number,
    gambar: String,
    reviews: [
        {
            userId: Number,
            name: String,
            rating: Number,
            comment: String,
            date: Date,
            reply: [
                {
                    userId: Number,
                    name: String,
                    comment: String,
                    date: Date
                }
            ]
        }
    ]
});

module.exports = mongoose.model('Product', productSchema);