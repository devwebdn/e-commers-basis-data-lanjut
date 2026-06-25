const express = require('express');
const router = express.Router();
const db = require('../db/mysql');
const { isManajer } = require('../middleware/authMiddleware');

router.get('/dashboard', isManajer, (req, res) => {
    res.render('manajer/dashboard');
});

router.get('/report', async (req, res) => {
    console.log('[REPORT ROUTE] Report route accessed');
    try {
        let barChart = { labels: [], data: [] };
        let pieChart = { labels: [], data: [] };
        let lineChart = { labels: [], data: [] };

        // Try to get product sales data
        try {
            const [products] = await db.promise().query(`
                SELECT p.name, SUM(oi.quantity) as total_sold
                FROM order_items oi
                JOIN products p ON oi.product_id = p.id
                GROUP BY oi.product_id
                ORDER BY total_sold DESC
            `);

            barChart = {
                labels: products.map(p => p.name || 'Tanpa Nama'),
                data: products.map(p => p.total_sold)
            };
        } catch (err) {
            console.log('[REPORT] Could not fetch products data:', err.message);
            barChart = {
                labels: ['Belum Ada Data'],
                data: [0]
            };
        }

        // Try to get role distribution data
        try {
            const [roles] = await db.promise().query(`
                SELECT u.role, COUNT(o.id) as total_orders
                FROM orders o
                JOIN users u ON o.user_id = u.id
                GROUP BY u.role
            `);

            const totalOrders = roles.reduce((sum, r) => sum + r.total_orders, 0);
            const formatRole = role => role.charAt(0).toUpperCase() + role.slice(1);

            if (totalOrders > 0) {
                pieChart = {
                    labels: roles.map(r => formatRole(r.role)),
                    data: roles.map(r =>
                        ((r.total_orders / totalOrders) * 100).toFixed(2)
                    )
                };
            } else {
                pieChart = {
                    labels: ['Belum Ada Data'],
                    data: [100]
                };
            }
        } catch (err) {
            console.log('[REPORT] Could not fetch roles data:', err.message);
            pieChart = {
                labels: ['Belum Ada Data'],
                data: [100]
            };
        }

        // Try to get daily sales data
        try {
            const [dailySales] = await db.promise().query(`
                SELECT DATE(created_at) AS tanggal,
                       SUM(total) AS total_harian
                FROM orders
                GROUP BY DATE(created_at)
                ORDER BY tanggal ASC
            `);

            if (dailySales.length > 0) {
                lineChart = {
                    labels: dailySales.map(s =>
                        s.tanggal.toISOString().split('T')[0]
                    ),
                    data: dailySales.map(s => s.total_harian)
                };
            } else {
                lineChart = {
                    labels: ['Belum Ada Data'],
                    data: [0]
                };
            }
        } catch (err) {
            console.log('[REPORT] Could not fetch daily sales data:', err.message);
            lineChart = {
                labels: ['Belum Ada Data'],
                data: [0]
            };
        }

        // Kirim semua chart ke EJS
        res.render('manajer/report', {
            barChart,
            pieChart,
            lineChart
        });
    } catch (err) {
        console.error('Error generating report:', err);
        res.render('manajer/report', {
            barChart: { labels: ['Error'], data: [0] },
            pieChart: { labels: ['Error'], data: [100] },
            lineChart: { labels: ['Error'], data: [0] }
        });
    }
});

// Route halaman laporan manajer
router.get('/laporan', async (req, res) => {
    try {
        const { start_date, end_date } = req.query;

        let reportQuery = `
            SELECT o.id, u.username, o.total, o.created_at
            FROM orders o
            JOIN users u ON o.user_id = u.id
        `;

        let reportParams = [];

        if (start_date && end_date) {
            reportQuery += `
                WHERE DATE(o.created_at) BETWEEN ? AND ?
            `;
            reportParams.push(start_date, end_date);
        }

        const [orders] = await db.promise().query(
            reportQuery,
            reportParams
        );

        const reportData = await Promise.all(
            orders.map(async order => {
                const [items] = await db.promise().query(
                    `
                    SELECT p.name AS nama,
                           op.quantity,
                           (op.quantity * p.price) AS subtotal
                    FROM order_items op
                    JOIN products p ON op.product_id = p.id
                    WHERE op.order_id = ?
                    `,
                    [order.id]
                );

                return {
                    ...order,
                    items
                };
            })
        );

        res.render('manajer/laporan', {
            reportData,
            startDate: start_date,
            endDate: end_date
        });
    } catch (err) {
        console.error('Gagal mengambil data laporan:', err);
        res.status(500).send(
            'Terjadi kesalahan saat mengambil data laporan'
        );
    }
});

module.exports = router;