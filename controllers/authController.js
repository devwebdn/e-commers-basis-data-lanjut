const db = require('../db/mysql');
const bcrypt = require('bcrypt');

exports.apiLoginUser = (req, res) => {
    const { username, password } = req.body;

    const sql = 'SELECT * FROM users WHERE username = ?';

    db.query(sql, [username], async (err, results) => {
        if (err) {
            return res.status(500).json({
                message: 'Server error'
            });
        }

        if (results.length === 0) {
            return res.status(401).json({
                message: 'Username tidak ditemukan'
            });
        }

        const user = results[0];

        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return res.status(401).json({
                message: 'Password salah'
            });
        }

        // Set session setelah login berhasil
        req.session.user = {
            id: user.id,
            username: user.username,
            role: user.role
        };

        // Role-based redirect
        let dashboardPath = '';

        switch (user.role) {
            case 'admin':
                dashboardPath = '/admin/dashboard';
                break;

            case 'pembeli':
                dashboardPath = '/pembeli/dashboard';
                break;

            case 'kasir':
                dashboardPath = '/kasir/dashboard';
                break;

            case 'manajer':
                dashboardPath = '/manajer/dashboard';
                break;

            default:
                return res.status(403).json({
                    message: 'Role tidak dikenali'
                });
        }

        return res.status(200).json({
            message: 'Login berhasil',
            role: user.role,
            redirectTo: dashboardPath
        });
    });
};

exports.insertUser = async (req, res) => {
    const { username, password, role } = req.body;

    try {
        // Cek apakah username sudah ada
        const [existingUser] = await db.promise().query(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );

        if (existingUser.length > 0) {
            return res.status(400).json({
                message: 'Username sudah digunakan'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user baru
        await db.promise().query(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            [username, hashedPassword, role]
        );

        res.status(201).json({
            message: 'User berhasil ditambahkan'
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: 'Gagal menambahkan user'
        });
    }
};