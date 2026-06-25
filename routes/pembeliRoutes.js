const express = require('express');
const router = express.Router();
const db = require('../db/mysql');
const Product = require('../models/product'); // mongoose model
const { isPembeli } = require('../middleware/authMiddleware');

// Dashboard pembeli
router.get('/dashboard', isPembeli, async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'pembeli') {
        return res.redirect('/login');
    }

    const user = req.session.user;

    db.query('SELECT * FROM products', async (err, mysqlProducts) => {
        if (err) return res.send('Gagal ambil data MySQL');

        try {
            const mongoDetails = await Product.find({});

            // Gabungan MySQL + MongoDB berdasarkan ID produk
            const combined = mysqlProducts.map(p => {
                const mongoData = mongoDetails.find(md => md.id === p.id);

                return {
                    ...p,
                    mongoId: mongoData?._id || null,
                    description:
                        mongoData?.description || 'Deskripsi tidak tersedia',
                    gambar: mongoData?.gambar || 'placeholder.jpg'
                };
            });

            const checkout = req.query.checkout || null;

            res.render('pembeli/dashboard', {
                user: user,
                products: combined,
                checkout: checkout
            });
        } catch (error) {
            console.error(error);
            res.send('Gagal ambil data produk dari MongoDB');
        }
    });
});

// Get detail produk
router.get('/produk/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).send('Produk tidak ditemukan');
        }

        res.render('detail_product', { product });
    } catch (error) {
        console.error('ERROR /produk/:id ->', error);
        res.status(500).send('Terjadi kesalahan server');
    }
});

// POST /pembeli/checkout
router.post('/checkout', async (req, res) => {
    const userId = req.session.user.id;
    const orderItems = JSON.parse(req.body.orderData);

    try {
        const [orderResult] = await db.promise().execute(
            'INSERT INTO orders (user_id, total, created_at) VALUES (?, ?, NOW())',
            [userId, 0] // Total dihitung nanti
        );

        const orderId = orderResult.insertId;

        // sebelum loop
        let total = 0;

        // selama loop
        for (const item of orderItems) {
            const [product] = await db.promise().execute(
                'SELECT * FROM products WHERE id = ?',
                [item.id]
            );

            if (
                product.length === 0 ||
                product[0].stok < item.quantity
            ) {
                continue;
            }

            const subtotal = product[0].price * item.quantity;
            total += subtotal;

            // insert ke order_items
            await db.promise().execute(
                'INSERT INTO order_items (order_id, product_id, quantity, subtotal) VALUES (?, ?, ?, ?)',
                [orderId, item.id, item.quantity, subtotal]
            );

            // kurangi stok MySQL
            await db.promise().execute(
                'UPDATE products SET stok = stok - ? WHERE id = ?',
                [item.quantity, item.id]
            );

            // kurangi stok MongoDB
            const mongoDB = require('../db/mongodb');

            await Product.updateOne(
                { id: parseInt(item.id) },
                { $inc: { stok: -item.quantity } }
            );
        }

        console.log('Total akhir yang akan disimpan ke orders:', total);

        // setelah loop selesai, baru update total
        await db.promise().execute(
            'UPDATE orders SET total = ? WHERE id = ?',
            [total, orderId]
        );

        res.redirect('/pembeli/dashboard?checkout=success');
    } catch (err) {
        console.error(err);
        res.status(500).send('Gagal checkout');
    }
});

// GET /pembeli/riwayat
router.get('/riwayat', async (req, res) => {
    const userId = req.session.user.id;
    const user = req.session.user;

    try {
        const [orders] = await db.promise().execute(
            `SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC`,
            [userId]
        );

        for (let order of orders) {
            const [items] = await db.promise().execute(
                `SELECT oi.*, p.name
                 FROM order_items oi
                 JOIN products p ON oi.product_id = p.id
                 WHERE order_id = ?`,
                [order.id]
            );

            // Ambil review dari MongoDB berdasarkan product_id
            for (let item of items) {
                const product = await Product.findOne({
                    id: item.product_id
                });

                if (product && product.reviews) {
                    const existingReview = product.reviews.find(
                        r => r.userId == userId
                    );

                    if (existingReview) {
                        item.review = existingReview; // Tambahkan ke item
                    }
                }
            }

            order.items = items;
        }

        res.render('pembeli/riwayat', {
            orders,
            user
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Gagal menampilkan riwayat');
    }
});

// POST /pembeli/review/:productId
router.post('/review/:id', async (req, res) => {
    const { rating, comment } = req.body;
    const mysqlId = parseInt(req.params.id);
    const userId = req.body?.userId || 1;
    const userName = req.body?.userName || 'Pembeli Uji Coba';

    const reviewData = {
        userId,
        name: userName,
        rating: parseInt(rating),
        comment,
        date: new Date()
    };

    try {
        await Product.updateOne(
            { id: mysqlId }, // cocokkan dengan field `id` dari MySQL
            { $push: { reviews: reviewData } }, // tambahkan field baru `reviews`
            { upsert: true } // kalau belum ada dokumen, buat baru
        );

        res.redirect('/pembeli/riwayat');
    } catch (err) {
        console.error('Gagal menyimpan review:', err);
        res.status(500).send('Gagal menyimpan review');
    }
});

module.exports = router;