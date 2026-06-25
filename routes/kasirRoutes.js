const express = require('express');
const router = express.Router();
const db = require('../db/mysql.js');
const Product = require('../models/product.js'); // mongoose model
const { isKasir } = require('../middleware/authMiddleware.js');

// Dashboard kasir
router.get('/dashboard', isKasir, async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'kasir') {
        return res.redirect('/login');
    }

    const user = req.session.user;

    db.query('SELECT * FROM products', async (err, mysqlProducts) => {
        if (err) return res.send('Gagal ambil data MySQL');

        try {
            const mongoDetails = await Product.find({});

            // Gabungkan MySQL + MongoDB berdasarkan ID produk
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
            const orderId = req.query.orderId || null;

            res.render('kasir/dashboard', {
                user: user,
                products: combined,
                checkout: checkout,
                orderId
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

// POST /checkout
router.post('/checkout', async (req, res) => {
    // console.log('[DEBUG] POST /pembeli/checkout HIT');
    // console.log('orderData raw:', req.body.orderData);

    const userId = req.session.user.id;
    const orderItems = JSON.parse(req.body.orderData);

    try {
        const [orderResult] = await db.promise().execute(
            'INSERT INTO orders (user_id, total, created_at) VALUES (?, ?, NOW())',
            [userId, 0]
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

            if (product.length === 0 || product[0].stok < item.quantity) {
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

        res.redirect(
            `/kasir/dashboard?checkout=success&orderId=${orderId}`
        );
    } catch (err) {
        console.error(err);
        res.status(500).send('Gagal checkout');
    }
});

// GET struk
router.get('/struk/:orderId', async (req, res) => {
    const orderId = req.params.orderId;
    const user = req.session.user;

    try {
        const [itemsResult] = await db.promise().execute(
            `
            SELECT oi.quantity, oi.subtotal, p.name, p.price
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
            `,
            [orderId]
        );

        const total = itemsResult.reduce(
            (sum, item) => sum + item.subtotal,
            0
        );

        res.render('kasir/struk', {
            kasir: user,
            items: itemsResult,
            total
        });
    } catch (err) {
        console.error('Gagal ambil data struk:', err);
        res.status(500).send('Gagal menampilkan struk');
    }
});

module.exports = router;