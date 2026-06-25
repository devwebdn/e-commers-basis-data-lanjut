// middlewares/authMiddleware.js

function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        res.redirect('/login');
    }
}

function isKasir(req, res, next) {
    if (req.session.user && req.session.user.role === 'kasir') {
        next();
    } else {
        res.redirect('/login');
    }
}

function isManajer(req, res, next) {
    if (req.session.user && req.session.user.role === 'manajer') {
        next();
    } else {
        res.redirect('/login');
    }
}

function isPembeli(req, res, next) {
    if (req.session.user && req.session.user.role === 'pembeli') {
        next();
    } else {
        res.redirect('/login');
    }
}

module.exports = {
    isAdmin,
    isKasir,
    isManajer,
    isPembeli
};