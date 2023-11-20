const express = require('express');
const redis = require('ioredis');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const bodyParser = require('body-parser');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 3000;
const secret = 'tokenlogin2023';
const moment = require('moment-timezone');
const nombreAplicación = "appUsuarios";

// Conectar a la base de datos SQLite
const db = new sqlite3.Database(process.env.DATABASE_URL);
const verificarToken = require('./verificarToken');


// Middleware para permitir JSON en las solicitudes
app.use(express.json());
const resetTokens = {};
app.use(bodyParser.json());

//Configuracion de redis
// Obtener la configuración de Redis desde variables de entorno
const redisHost = process.env.REDIS_HOST
const redisPort = process.env.REDIS_PORT
const canalLogs = process.env.CANAL_LOGS
const canalRegistro = process.env.CANAL_EVENTOS_REGISTRO

app.use(express.static(__dirname));
// Crear la tabla de usuarios si no existe
db.run(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    contrasena TEXT NOT NULL,
    email TEXT NOT NULL
  )
`, (err) => {
    if (err) {
        console.error('Error al crear la tabla usuarios:', err.message);
    } else {
        console.log('Tabla usuarios creada o ya existente');
    }
});


// Configuración para el cliente de publicación
const publisherClient = new redis({
    host: redisHost,
    port: redisPort,
});

// Establecer la conexión a Redis para el cliente de publicación
publisherClient.on('connect', () => {
    console.log('Cliente de publicación conectado a Redis');
});

// Manejar errores de conexión para el cliente de publicación
publisherClient.on('error', (err) => {
    console.error('Error en el cliente de publicación Redis:', err);
});



// Ruta para obtener todos los usuarios
app.get('/usuarios', (req, res) => {
    const page = req.query.page || 1; // Página actual
    const perPage = req.query.perPage || 10; // Usuarios por página
    const offset = (page - 1) * perPage;

    const countQuery = 'SELECT COUNT(*) AS total FROM usuarios';
    const usersQuery = `SELECT * FROM usuarios LIMIT ${perPage} OFFSET ${offset}`;

    db.get(countQuery, [], (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Error en el servidor' });
        }

        const totalUsers = row.total;

        db.all(usersQuery, [], (err, rows) => {
            if (err) {
                return res.status(500).json({ error: 'Error en el servidor' });
            }

            res.json({
                page,
                perPage,
                totalUsers,
                users: rows,
            });
        });
    });
});

// Ruta para agregar un nuevo usuario
app.post('/usuarios', (req, res) => {
    const { nombre, contrasena, email } = req.body;

    if (!nombre || !contrasena || !email) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    // Verificar si el correo electrónico ya existe en la base de datos
    db.get('SELECT id FROM usuarios WHERE email = ?', [email], (err, row) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: 'Error en el servidor' });
        }

        if (row) {
            return res.status(400).json({ error: 'El correo electrónico ya está registrado' });
        }

        // Si el correo electrónico no existe, insertar el nuevo usuario en la base de datos
        const query = 'INSERT INTO usuarios (nombre, contrasena, email) VALUES (?, ?, ?)';
        db.run(query, [nombre, contrasena, email], function (err) {
            if (err) {
                console.error(err.message);
                return res.status(500).json({ error: 'Error en el servidor' });
            }

            const userId = this.lastID;
            res.json({ message: 'Usuario agregado con éxito', userId: userId });

            // Crear y publicar el evento de usuario registrado en Redis
            const userRegisteredEvent = {
                type: 'USER_REGISTERED',
                userId: userId,
            };
            publisherClient.publish(canalRegistro, JSON.stringify(userRegisteredEvent));

            // Crear un registro de log para el servicio de registro de usuario
            const logData = {
                application: nombreAplicación,
                fecha_hora: moment().tz('America/Bogota').format('YYYY-MM-DD HH:mm:ss'),
                tipo_log: 'Registro de Usuario',
                modulo: 'Usuarios',
                resumen: 'Se ha registrado un nuevo usuario',
                descripcion: `Se ha registrado un nuevo usuario con el correo ${email}`,
            };
            // Se publican los datos del log en el canal 'canal-logs' de Redis
            publisherClient.publish(canalLogs, JSON.stringify(logData));
        });
    });
});


// Ruta para actualizar los datos de un usuario por ID
app.put('/usuarios/:id', async (req, res) => {
    const userId = req.params.id;
    const { nombre, email } = req.body;

    if (!userId || (!nombre && !email)) {
        res.status(400).json({ error: 'Se requiere al menos un campo para actualizar (nombre o email)' });
        return;
    }

    // Verificar si el usuario existe en la base de datos
    const user = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM usuarios WHERE id = ?', [userId], (err, row) => {
            if (err) {
                reject(err);
            }
            resolve(row);
        });
    });

    if (!user) {
        res.status(404).json({ error: 'Usuario no encontrado' });
        return;
    }

    // Construir la consulta SQL para actualizar los campos proporcionados
    const updateFields = [];
    const updateValues = [];

    if (nombre) {
        updateFields.push('nombre = ?');
        updateValues.push(nombre);
    }

    if (email) {
        updateFields.push('email = ?');
        updateValues.push(email);
    }

    const updateQuery = `UPDATE usuarios SET ${updateFields.join(', ')} WHERE id = ?`;
    updateValues.push(userId);

    db.run(updateQuery, updateValues, (err) => {
        if (err) {
            console.error(err.message);
            res.status(500).json({ error: 'Error en el servidor' });
            return;
        }
        res.json({ message: 'Datos de usuario actualizados con éxito' });
    });
});

// Ruta para verificar la autenticación del usuario
app.get('/autenticacion/:id', verificarToken, (req, res) => {
    // Si el middleware de verificarToken no lanza un error, el usuario está autenticado
    res.json({ message: 'Autenticación verificada con éxito', userId: req.params.id });
});

// Ruta para eliminar un usuario por ID
app.delete('/usuarios/:id', verificarToken, (req, res) => {
    const userId = req.params.id;

    if (!userId) {
        return res.status(400).json({ error: 'ID de usuario no proporcionado' });
    }

    // Asegurarse de que el usuario solo pueda eliminar su propio perfil
    if (req.userId !== parseInt(userId)) {
        return res.status(403).json({ error: 'No autorizado para eliminar este usuario' });
    }

    const query = 'DELETE FROM usuarios WHERE id = ?';
    db.run(query, [userId], (err) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: 'Error en el servidor' });
        }

        // Crear un registro de log para el servicio de registro de usuario
        const logData = {
            application: nombreAplicación,
            fecha_hora: moment().tz('America/Bogota').format('YYYY-MM-DD HH:mm:ss'),
            tipo_log: 'Eliminación de Usuario',
            modulo: 'Usuarios',
            resumen: 'Se ha eliminado un usuario',
            descripcion: `El usuario ha eliminado su cuenta`,
        };
        // Se publican los datos del log en el canal 'canal-logs' de Redis
        publisherClient.publish(canalLogs, JSON.stringify(logData));

        // Publicar un evento para eliminar el perfil asociado al usuario
        const userDeletedEvent = {
            type: 'USER_DELETED',
            userId: userId,
        };
        publisherClient.publish(canalRegistro, JSON.stringify(userDeletedEvent));
        res.json({ message: 'Usuario eliminado con éxito' });
    });
});


// Ruta para el inicio de sesión de usuario
app.post('/sesion', async (req, res) => {
    const { email, contrasena } = req.body;

    // Validar los datos de inicio de sesión
    if (!email || !contrasena) {
        res.status(400).json({ error: 'Email y contraseña son obligatorios' });
        return;
    }

    // Verificar si el usuario existe en la base de datos
    const user = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM usuarios WHERE email = ?', [email], (err, row) => {
            if (err) {
                reject(err);
            }
            resolve(row);
        });
    });

    if (!user || contrasena !== user.contrasena) {
        res.status(401).json({ error: 'Credenciales inválidas' });

        // Crear un registro de log para el error de autenticación
        const errorLogData = {
            application: nombreAplicación,
            fecha_hora: moment().tz('America/Bogota').format('YYYY-MM-DD HH:mm:ss'),
            tipo_log: 'Error',
            modulo: 'Autenticación',
            resumen: 'Error de inicio de sesión',
            descripcion: 'El usuario no pudo iniciar sesión debido a credenciales incorrectas.',
        };
        // Publicar un mensaje a Redis si existe error en credenciales
        publisherClient.publish(canalLogs, JSON.stringify(errorLogData));
        return;
    }

    // Si la autenticación es exitosa, generamos el token JWT y respondemos con éxito.
    // Generamos un LOG cuando se genera un nuevo token
    const token = jwt.sign({ userId: user.id }, secret, { expiresIn: '1h' });
    const logData = {
        application: nombreAplicación,
        fecha_hora: moment().tz('America/Bogota').format('YYYY-MM-DD HH:mm:ss'),
        tipo_log: 'Generación de Token',
        modulo: 'Autenticación',
        resumen: 'Generación exitosa de token',
        descripcion: `Se ha generado un nuevo token JWT para el usuario con correo ${email}`,
    };

    // Publica el LOG en el canal 'canal-logs' de Redis
    publisherClient.publish(canalLogs, JSON.stringify(logData));
    res.json({ message: 'Inicio de sesión exitoso', token });


    // Crear un registro de log para el inicio de sesión exitoso
    const successLogData = {
        application: nombreAplicación,
        fecha_hora: moment().tz('America/Bogota').format('YYYY-MM-DD HH:mm:ss'),
        tipo_log: 'Autenticación',
        modulo: 'Autenticación',
        resumen: 'El Usuario se ha autenticado con éxito',
        descripcion: `El usuario con el correo ${email} se ha autenticado con éxito.`,
    };

    // Publicar un mensaje a Redis cuando el usuario se autentique
    publisherClient.publish(canalLogs, JSON.stringify(successLogData));
});

// Ruta para actualizar la contraseña del usuario
app.put('/usuarios/:id/clave', verificarToken, async (req, res) => {
    const userId = req.params.id;
    const { contrasenaActual, nuevaContrasena } = req.body;

    if (!userId || !contrasenaActual || !nuevaContrasena) {
        res.status(400).json({ error: 'Todos los campos son obligatorios' });
        return;
    }

    // Verificar si el usuario existe en la base de datos
    const user = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM usuarios WHERE id = ?', [userId], (err, row) => {
            if (err) {
                reject(err);
            }
            resolve(row);
        });
    });

    if (!user) {
        res.status(404).json({ error: 'Usuario no encontrado' });
        return;
    }

    // Verificar que la contraseña actual coincida con la almacenada en la base de datos
    if (user.contrasena !== contrasenaActual) {
        res.status(401).json({ error: 'Contraseña actual incorrecta' });
        return;
    }

    // Actualizar la contraseña del usuario en la base de datos
    const updateQuery = 'UPDATE usuarios SET contrasena = ? WHERE id = ?';
    db.run(updateQuery, [nuevaContrasena, userId], (err) => {
        if (err) {
            console.error(err.message);
            res.status(500).json({ error: 'Error en el servidor' });
            return;
        }
        res.json({ message: 'Contraseña actualizada con éxito' });
    });

    // Crear un registro de log para el servicio de actualización de contraseña
    const logData = {
        application: nombreAplicación,
        fecha_hora: moment().tz('America/Bogota').format('YYYY-MM-DD HH:mm:ss'),
        tipo_log: 'Actualización de Contraseña',
        modulo: 'Usuarios',
        resumen: 'Se ha actualizado la contraseña de un usuario',
        descripcion: `Se ha actualizado la contraseña del usuario con ID ${userId}`,
    };
    // Publicar un mensaje a Redis 
    publisherClient.publish(canalLogs, JSON.stringify(logData));

});


// Ruta para solicitar recuperación de contraseña
app.post('/recuperacion_contra', (req, res) => {
    const { email } = req.body;

    // Generar un token de recuperación de contraseña
    const resetToken = uuidv4();
    const expirationTime = new Date(Date.now() + 30 * 60 * 1000);
    resetTokens[email] = { token: resetToken, expirationTime };


    // Crear un registro de log para el servicio de solicitud de recuperación de contraseña
    const logData = {
        application: nombreAplicación,
        fecha_hora: moment().tz('America/Bogota').format('YYYY-MM-DD HH:mm:ss'),
        tipo_log: 'Recuperación de Contraseña',
        modulo: 'Usuarios',
        resumen: 'Se ha solicitado la recuperación de contraseña',
        descripcion: `Se ha solicitado la recuperación de contraseña para el correo ${email}`,
    };
    // Publicar un mensaje a Redis 
    publisherClient.publish(canalLogs, JSON.stringify(logData));

    // Aquí solo mostramos el token generado
    return res.status(200).json({ mensaje: 'Se ha generado un token de recuperación', token: resetToken });
});

// Ruta para restablecer la contraseña
app.post('/restablecimiento_contra', (req, res) => {
    const { email, new_password, reset_token } = req.body;

    // Verificar si el token coincide con el token almacenado
    if (resetTokens[email]) {
        const tokenInfo = resetTokens[email];
        const token = tokenInfo.token;
        const expirationTime = tokenInfo.expirationTime;

        if (token === reset_token && expirationTime > new Date()) {
            // En un escenario real, aquí actualizarías la contraseña en la base de datos
            // Simulación: imprimimos la nueva contraseña
            console.log(`Nueva contraseña para ${email}: ${new_password}`);

            // Crear un registro de log para el servicio de restablecimiento de contraseña exitoso
            const logData = {
                application: nombreAplicación,
                fecha_hora: moment().tz('America/Bogota').format('YYYY-MM-DD HH:mm:ss'),
                tipo_log: 'Restablecimiento de Contraseña',
                modulo: 'Usuarios',
                resumen: 'Se ha restablecido la contraseña de un usuario',
                descripcion: `Se ha restablecido la contraseña del usuario con correo ${email}`,
            };

            // Publicar un mensaje a Redis 
            publisherClient.publish(canalLogs, JSON.stringify(logData));

            delete resetTokens[email]; // Eliminar el token después de su uso

            return res.status(200).json({ mensaje: 'Contraseña actualizada exitosamente' });
        } else {
            // Crear un registro de log para el servicio de restablecimiento de contraseña fallido
            const logData = {
                application: nombreAplicación,
                fecha_hora: moment().tz('America/Bogota').format('YYYY-MM-DD HH:mm:ss'),
                tipo_log: 'Error',
                modulo: 'Usuarios',
                resumen: 'Error en el restablecimiento de contraseña',
                descripcion: 'Intento de restablecimiento de contraseña fallido debido a un token inválido o expirado.',
            };

            // Publicar un mensaje a Redis 
            publisherClient.publish(canalLogs, JSON.stringify(logData));
            return res.status(400).json({ mensaje: 'Token de recuperación inválido o expirado' });
        }
    } else {
        // Crear un registro de log para el servicio de restablecimiento de contraseña fallido
        const logData = {
            application: nombreAplicación,
            fecha_hora: moment().tz('America/Bogota').format('YYYY-MM-DD HH:mm:ss'),
            tipo_log: 'Error',
            modulo: 'Usuarios',
            resumen: 'Error en el restablecimiento de contraseña',
            descripcion: 'Intento de restablecimiento de contraseña fallido debido a un token no encontrado.',
        };

        // Publicar un mensaje a Redis 
        publisherClient.publish(canalLogs, JSON.stringify(logData));

        return res.status(400).json({ mensaje: 'No se encontró el token de recuperación' });
    }
});

//Rutas de Salud
// Función para verificar la base de datos
function checkDatabase() {
    return new Promise((resolve, reject) => {
        db.get('SELECT 1', (err) => {
            if (err) {
                return reject('La base de datos no está accesible');
            }
            resolve('La base de datos está accesible');
        });
    });
}

// Función para verificar Redis
function checkRedis() {
    return new Promise((resolve, reject) => {
        publisherClient.ping((err, pong) => {
            if (err || pong !== 'PONG') {
                return reject('Redis no está accesible');
            }
            resolve('Redis está accesible');
        });
    });
}

// Ruta para verificar el estado general del servicio
app.get('/health', async (req, res) => {
    try {
        const dbStatus = await checkDatabase();
        const redisStatus = await checkRedis();

        // Si llegamos aquí, ambos servicios están "vivos" y "listos"
        res.json({
            status: 'up',
            checks: [
                {
                    name: 'Readiness check',
                    status: dbStatus,
                },
                {
                    name: 'Liveness check',
                    status: redisStatus,
                }
            ]
        });
    } catch (error) {
        // Si hay un error, uno de los servicios no está "vivo" o "listo"
        res.status(500).json({
            status: 'down',
            checks: [
                {
                    name: 'Readiness check',
                    status: 'La base de datos no está accesible',
                },
                {
                    name: 'Liveness check',
                    status: 'Redis no está accesible',
                }
            ],
            error: error
        });
    }
});

// Ruta para verificar si el servicio está listo para manejar tráfico
app.get('/health/ready', (req, res) => {
    try {
        // Verifica si la base de datos está conectada
        db.get('SELECT 1', (err) => {
            if (err) {
                throw new Error('La base de datos no está accesible');
            }
            // Verifica si Redis está conectado
            publisherClient.ping((err, pong) => {
                if (err) {
                    throw new Error('Redis no está accesible');
                }
                if (pong !== 'PONG') {
                    throw new Error('Respuesta inesperada de Redis');
                }
                res.json({ status: 'ready' });
            });
        });
    } catch (error) {
        res.status(500).json({ status: 'not ready', error: error.message });
    }
});

// Ruta para verificar si el servicio está vivo
app.get('/health/live', (req, res) => {
    // Si puedes responder a esta solicitud, entonces el servicio está vivo
    res.json({ status: 'live' });
});


// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor escuchando en el puerto ${port}`);
});
