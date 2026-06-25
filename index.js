console.log('[SERVER] Starting application...');

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');

const app = express();

require('./db/mysql');
require('./db/mongodb');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const kasirRoutes = require('./routes/kasirRoutes');
const manajerRoutes = require('./routes/manajerRoutes');
const pembeliRoutes = require('./routes/pembeliRoutes');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
    session({
        secret: 'misal',
        resave: false,
        saveUninitialized: false,
        cookie: {
            maxAge: 1000 * 60 * 60 // 1 jam
        }
    })
);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static('public'));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/uploads', express.static('uploads'));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use('/', authRoutes);
app.use('/admin', adminRoutes);
app.use('/kasir', kasirRoutes);
app.use('/manajer', manajerRoutes);
app.use('/pembeli', pembeliRoutes);

app.get('/', (req, res) => {
    res.render('welcome');
});

app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});