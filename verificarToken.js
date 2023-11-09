const jwt = require('jsonwebtoken');
const secret = 'tokenlogin2023';


function verificarToken(req, res, next) {
    const token = req.header('Authorization');

    if (!token) {
        return res.status(401).json({ error: 'Acceso no autorizado' });
    }

    try {
        // Verificar y decodificar el token usando el secreto
        const decoded = jwt.verify(token.replace('Bearer ', ''), secret);
        req.userId = decoded.userId;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token no válido' });
    }
}

module.exports = verificarToken;
