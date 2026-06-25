const express = require('express');
const router = express.Router();
const db = require('../db/mysql.js');
const Product = require('../models/product.js');
const upload = require('../middleware/upload.js');
const { isAdmin } = require('../middleware/authMiddleware.js');

router.get('/dashboard', isAdmin, async (req, res) => {
    const user = req.session.user;

    try {
        // Ambil data dari MySQL
        const mysqlRows = await new Promise((resolve, reject) => {
            db.query('SELECT * FROM products', (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        });

        // Ambil data gambar + deskripsi dari MongoDB
        const mongoProducts = await Product.find();

        // Gabungkan berdasarkan id
        const merged = mysqlRows.map(p => {
            const mongo = mongoProducts.find(m => m.id === p.id);

            return {
                ...p,
                description: mongo?.description || 'Deskripsi tidak tersedia',
                gambar: mongo?.gambar || null
            };
        });

        res.render('admin/dashboard', {
            user,
            products: merged
        });
    } catch (err) {
        console.error('LOAD ERROR:', err);
        res.status(500).send('Error loading products');
    }
});

// Add product
router.post('/add', upload.single('gambar'), (req, res) => {
    const { id, name, price, stok, description } = req.body;
    const gambar = req.file ? req.file.filename : null;

    console.log('File uploaded:', req.file);

    const sql =
        'INSERT INTO products (id, name, price, stok) VALUES (?, ?, ?, ?)';

    db.query(sql, [id, name, price, stok], err => {
        if (err) return res.status(500).send(err.message);

        const newProduct = new Product({
            id,
            name,
            price,
            stok,
            gambar,
            description
        });

        console.log('Saving product to MongoDB:', {
            id,
            name,
            price,
            stok,
            gambar,
            description
        });

        newProduct
            .save()
            .then(() => res.redirect('/admin/dashboard'))
            .catch(err => res.status(500).send(err.message));
    });
});

// Update product
router.post('/update/:id', upload.single('gambar'), (req, res) => {
    const { name, price, stok, description } = req.body;
    const id = req.params.id;
    const gambar = req.file ? req.file.filename : null;

    db.query(
        'UPDATE products SET name=?, price=?, stok=? WHERE id=?',
        [name, price, stok, id],
        err => {
            if (err) return res.status(500).send(err.message);

            // Update MongoDB
            const updateObj = {
                name,
                price,
                stok,
                description
            };

            console.log('Updating MongoDB:', updateObj);

            if (gambar) updateObj.gambar = gambar;

            Product.findOneAndUpdate(
                { id: parseInt(id) },
                updateObj
            )
                .then(() => res.redirect('/admin/dashboard'))
                .catch(err => res.status(500).send(err.message));
        }
    );
});

// Delete product
router.get('/delete/:id', (req, res) => {
    const id = req.params.id;

    db.query('DELETE FROM products WHERE id=?', [id], err => {
        if (err) return res.status(500).send(err.message);

        Product.findOneAndDelete({ id: parseInt(id) })
            .then(() => res.redirect('/admin/dashboard'))
            .catch(err => res.status(500).send(err.message));
    });
});

router.get('/review', async (req, res) => {
    try {
        const products = await Product.find({
            reviews: {
                $exists: true,
                $not: { $size: 0 }
            }
        });

        res.render('admin/review', {
            products,
            session: req.session
        });
    } catch (err) {
        console.error('Error load review:', err);
        res.status(500).send('Gagal memuat review');
    }
});

router.post('/reply/:productId/:reviewIndex', async (req, res) => {
    const { productId, reviewIndex } = req.params;
    const { userId, name, comment } = req.body;

    console.log('PARAMS:', productId, reviewIndex);
    console.log('BODY:', req.body);

    try {
        const product = await Product.findById(productId);

        if (!product || !product.reviews[reviewIndex]) {
            return res.status(404).send('Review tidak ditemukan');
        }

        const newReply = {
            userId,
            name,
            comment,
            date: new Date()
        };

        product.reviews[reviewIndex].reply = [newReply];
        await product.save();

        res.redirect('/admin/review');
    } catch (err) {
        console.error('GAGAL REPLY:', err);
        res.status(500).send('Gagal menyimpan balasan');
    }
});

module.exports = router;