const express = require('express');
const app = express();

const redis = require('ioredis');
module.exports = app;

const subscriberClient = new redis({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
});



const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('logs.db');

// Crear la tabla de logs si no existe
db.run(`
  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tipo_log TEXT NOT NULL,
    modulo TEXT,
    resumen TEXT,
    descripcion TEXT,
    application TEXT NOT NULL
  )
`, (err) => {
    if (err) {
        console.error('Error al crear la tabla logs:', err.message);
    } else {
        console.log('Tabla logs creada o ya existente');
    }
});

// suscribirse el canal
subscriberClient.subscribe('canal-logs', (err, count) => {
    if (!err) {
        console.log(`Subscrito a ${count} canales.`);
    } else {
        console.error('Error al suscribirse al canal "canal-logs":', err);
    }
});

// Manejamos los mensajes recibidos desde Redis en el canal 'canal-logs'
subscriberClient.on('message', (channel, message) => {
    console.log(`Mensaje recibido en el canal ${channel}: ${message}`);

    if (channel === 'canal-logs') {
        try {
            const logData = JSON.parse(message);

            // Insertar el registro de log en la base de datos
            db.run(
                'INSERT INTO logs (fecha_hora, tipo_log, modulo, resumen, descripcion, application) VALUES (?, ?, ?, ?, ?, ?)', // Incluye "application" en la inserción
                [logData.fecha_hora, logData.tipo_log, logData.modulo, logData.resumen, logData.descripcion, logData.application], // Agrega "logData.application" al array
                (err) => {
                    if (err) {
                        console.error('Error al insertar el registro de log:', err.message);
                    } else {
                        console.log('Registro de log creado con éxito.');
                    }
                }
            );
        } catch (error) {
            console.error('Error al procesar el mensaje:', error);
        }
    }
});


// Ruta para obtener todos los logs
app.get('/logs', (req, res) => {
    const { page = 1, perPage = 10, fromDate, toDate, tipoLog, application } = req.query;
    const offset = (page - 1) * perPage;
    const filters = [];
    const values = [];

    // Filtro de fecha
    if (fromDate) {
        filters.push('fecha_hora >= ?');
        values.push(fromDate);
    }

    if (toDate) {
        filters.push('fecha_hora <= ?');
        values.push(toDate);
    }

    // Filtro tipo log
    if (tipoLog) {
        filters.push('tipo_log = ?');
        values.push(tipoLog);
    }

    // Filtro de aplicación
    if (application) {
        filters.push('application = ?');
        values.push(application);
    }

    let query = 'SELECT * FROM logs';

    if (filters.length > 0) {
        query += ' WHERE ' + filters.join(' AND ');
    }

    query += ` ORDER BY fecha_hora DESC LIMIT ${perPage} OFFSET ${offset}`;

    db.all(query, values, (err, rows) => {
        if (err) {
            console.error(err.message);
            res.status(500).json({ error: 'Error en el servidor al consultar los logs' });
            return;
        }

        res.json({
            page,
            perPage,
            totalLogs: rows.length,
            logs: rows,
        });
    });
});


// Ruta para obtener todos los logs de una aplicación específica
app.get('/logs/:application', (req, res) => {
    const { application } = req.params;
    const { page = 1, perPage = 10, fromDate, toDate, tipoLog } = req.query;
    const offset = (page - 1) * perPage;
    const filters = [];
    const values = [application];

    // Filtro de fecha
    if (fromDate) {
        filters.push('fecha_hora >= ?');
        values.push(fromDate);
    }

    if (toDate) {
        filters.push('fecha_hora <= ?');
        values.push(toDate);
    }

    // Filtro tipo log
    if (tipoLog) {
        filters.push('tipo_log = ?');
        values.push(tipoLog);
    }

    let query = 'SELECT * FROM logs WHERE application = ?';

    if (filters.length > 0) {
        query += ' AND ' + filters.join(' AND ');
    }

    query += ` ORDER BY fecha_hora DESC LIMIT ${perPage} OFFSET ${offset}`;

    db.all(query, values, (err, rows) => {
        if (err) {
            console.error(err.message);
            res.status(500).json({ error: 'Error en el servidor al consultar los logs' });
            return;
        }

        res.json({
            page,
            perPage,
            totalLogs: rows.length,
            logs: rows,
        });
    });
});


// Ruta para crear un nuevo log
app.post('/logs', (req, res) => {
    const { application, tipoLog, modulo, resumen, descripcion } = req.body;

    if (!logData.application) {
        console.error('El campo "application" es nulo o no está definido');
        return;
    }
    if (!application || !tipoLog || !modulo || !resumen || !descripcion) {
        res.status(400).json({ error: 'Todos los campos son obligatorios' });
        return;
    }

    const fecha_hora = moment().tz('America/Bogota').format('YYYY-MM-DD HH:mm:ss'); // Fecha y hora actual

    // Crear un registro de log en la base de datos de logs
    const logData = {
        application,
        fecha_hora,
        tipo_log: tipoLog,
        modulo: modulo,
        resumen: resumen,
        descripcion: descripcion,
    };

    db.run('INSERT INTO logs (application, fecha_hora, tipo_log, modulo, resumen, descripcion) VALUES (?, ?, ?, ?, ?, ?)',
        [logData.application, logData.fecha_hora, logData.tipo_log, logData.modulo, logData.resumen, logData.descripcion], (err) => {
            if (err) {
                console.error('Error al insertar el registro de log:', err.message);
                res.status(500).json({ error: 'Error en el servidor al crear el log' });
                return;
            }

            res.json({ message: 'Registro de log creado con éxito' });
        });
});

// Ruta para verificar el estado general del servicio (Health Check)
app.get('/health', (req, res) => {
    res.json({ status: 'UP' });
});

// Ruta para verificar si el servicio está vivo (Liveness Check)
app.get('/health/live', (req, res) => {
    res.json({ status: 'ALIVE' });
});

// Ruta para verificar si el servicio está listo para manejar tráfico (Readiness Check)
app.get('/health/ready', async (req, res) => {
    try {
        // Verificar la conexión a la base de datos SQLite
        await new Promise((resolve, reject) => {
            db.get('SELECT 1', (err) => {
                if (err) reject('Database not ready');
                else resolve('Database ready');
            });
        });

        // Verificar la conexión a Redis
        const pong = await subscriberClient.ping();
        if (pong !== 'PONG') {
            throw new Error('Redis not ready');
        }

        res.json({ status: 'READY' });
    } catch (error) {
        res.status(500).json({ status: 'NOT READY', error: error });
    }
});



const port = 4001;
app.listen(port, () => {
    console.log(`Servidor de logs escuchando en el puerto ${port}`);
});

