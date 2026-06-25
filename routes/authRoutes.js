const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController.js');

router.get('/login', (req, res) => {
    res.render('login'); // Pastikan file views/login.ejs ada
});

router.post('/api/login', authController.apiLoginUser);

router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send('Gagal logout');
        }

        res.redirect('/login');
    });
});

router.post('/register', authController.insertUser);

router.get('/register', (req, res) => {
    res.render('register');
});

module.exports = router;