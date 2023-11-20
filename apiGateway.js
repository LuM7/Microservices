const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const bodyParser = require('body-parser');
const app = express();
const redis = require('ioredis');

app.use(express.json());
app.use(bodyParser.json());

const PORT = 3003;
const SERVICIO_AUTENTICACION_URL = 'http://app:3000';
const SERVICIO_PERFIL_URL = 'http://perfil:3002';

app.use(cors());

// Configuración del cliente de Redis para publicar logs
const redisClient = new redis({
    host: 'redis',
    port: 6379
});

// Función para registrar logs
function registrarLog(logData) {
    redisClient.publish('canal-logs', JSON.stringify(logData));
}

// Función para verificar la autenticación en app.js
async function verificarAutenticacion(userId, token) {
    try {
        // Asumiendo que app.js tiene una ruta para verificar el token
        const respuesta = await axios.get(`${SERVICIO_AUTENTICACION_URL}/autenticacion/${userId}`, {
            headers: { 'Authorization': token }
        });
        return respuesta.data;
    } catch (error) {
        console.error("Error al verificar la autenticación: ", error.response ? error.response.data : error.message);
        throw error;
    }
}

// Función para unificar respuestas de los servicios
async function unificarRespuestas(respuestas) {
    let respuestaUnificada = {};

    for (let respuesta of respuestas) {
        if (respuesta.status >= 200 && respuesta.status < 300) {
            respuestaUnificada = { ...respuestaUnificada, ...respuesta.data };
        } else {
            console.error("Error en una solicitud: ", respuesta);
            throw new Error(respuesta.data || "Error en una de las respuestas");
        }
    }

    return respuestaUnificada;
}

// Rutas para autenticación y registro
app.post('/sesion', async (req, res) => {
    try {
        const response = await axios.post(`${SERVICIO_AUTENTICACION_URL}/sesion`, req.body);
        res.json(response.data);
        // Registrar un log exitoso
        registrarLog({
            application: 'API Gateway',
            fecha_hora: new Date().toISOString(),
            tipo_log: 'Operación Exitosa',
            modulo: 'Inicio de sesión',
            resumen: `El usuario ${req.body.email} ha iniciado sesión exitosamente`,
            descripcion: `Usuario ${req.body.email} autenticado`
        });
    } catch (error) {
        res.status(error.response ? error.response.status : 500).json(error.response ? error.response.data : { error: "Error al iniciar sesión" });
    }
    // Registrar un log exitoso
    registrarLog({
        application: 'API Gateway',
        fecha_hora: new Date().toISOString(),
        tipo_log: 'Operación Denegada',
        modulo: 'Inicio de sesión',
        resumen: `No se pudo iniciar sesión, verifica tus credenciales e intentalo de nuevor`,
        descripcion: `El usuario ${req.body.email} no autenticado`
    });
});

app.post('/usuarios', async (req, res) => {
    try {
        const response = await axios.post(`${SERVICIO_AUTENTICACION_URL}/usuarios`, req.body);
        res.json(response.data);
        // Registrar un log exitoso
        registrarLog({
            application: 'API Gateway',
            fecha_hora: new Date().toISOString(),
            tipo_log: 'Operación Exitosa',
            modulo: 'Registro de Usuario',
            resumen: 'Usuario registrado con éxito',
            descripcion: `Usuario ${req.body.email} registrado`
        });
    } catch (error) {
        res.status(error.response ? error.response.status : 500).json(error.response ? error.response.data : { error: "Error al crear usuario" });
    }
    // Registrar un log de error
    registrarLog({
        application: 'API Gateway',
        fecha_hora: new Date().toISOString(),
        tipo_log: 'Error',
        modulo: 'Registro de Usuario',
        resumen: 'Error al registrar usuario',
        descripcion: `Error al registrar usuario: ${error.message}`
    });
});


// Rutas para actualizar y consultar datos de usuario
app.put('/usuario/:id', async (req, res) => {
    const userId = req.params.id;
    const token = req.headers['authorization'];
    const { nombre, email, contrasena, ...datosPerfil } = req.body;

    try {
        await verificarAutenticacion(userId, token);

        const respuestas = [];

        // Actualizar información del usuario
        if (nombre || email || contrasena) {
            const respuestaAutenticacion = await axios.put(`${SERVICIO_AUTENTICACION_URL}/usuarios/${userId}`, { nombre, email, contrasena });
            respuestas.push(respuestaAutenticacion);
        }

        // Actualizar perfil del usuario
        if (Object.keys(datosPerfil).length > 0) {
            const respuestaPerfil = await axios.put(`${SERVICIO_PERFIL_URL}/perfil/${userId}`, datosPerfil, {
                headers: { 'Authorization': token }
            });
            respuestas.push(respuestaPerfil);
        }

        const respuestaUnificada = await unificarRespuestas(respuestas);
        res.json(respuestaUnificada);
        // Registrar un log exitoso
        registrarLog({
            application: 'API Gateway',
            fecha_hora: new Date().toISOString(),
            tipo_log: 'Operación Exitosa',
            modulo: 'Actualización de Usuario',
            resumen: 'La actualización de datos se ha realizado con éxito',
            descripcion: `Usuario ${req.body.id} actualizó sus datos`
        });
    } catch (error) {
        res.status(error.response ? error.response.status : 500).json(error.response ? error.response.data : { error: "Error al actualizar el usuario" });
    }
});



app.get('/usuario/:id', async (req, res) => {
    const userId = req.params.id;
    const token = req.headers['authorization'];

    try {
        // Verificar la autenticación del usuario
        await verificarAutenticacion(userId, token);

        // Respuestas de consulta del usuario y perfil
        const respuestas = await Promise.all([
            axios.get(`${SERVICIO_AUTENTICACION_URL}/usuarios/${userId}`),
            axios.get(`${SERVICIO_PERFIL_URL}/perfil/${userId}`)
        ]);

        // Unificar las respuestas y enviarlas
        const respuestaUnificada = await unificarRespuestas(respuestas);
        res.json(respuestaUnificada);
    } catch (error) {
        res.status(error.response ? error.response.status : 500).json(error.response ? error.response.data : { error: "Error al consultar el usuario" });
    }
});


// Función para comprobar el servicio de autenticación
async function checkAuthService() {
    try {
        const response = await axios.get(`${SERVICIO_AUTENTICACION_URL}/health`);
        return response.data;
    } catch (error) {
        throw new Error('El servicio de autenticación no está accesible');
    }
}

// Función para comprobar el servicio de perfil
async function checkProfileService() {
    try {
        const response = await axios.get(`${SERVICIO_PERFIL_URL}/health`);
        return response.data;
    } catch (error) {
        throw new Error('El servicio de perfil no está accesible');
    }
}

// Ruta para verificar el estado general del API Gateway
app.get('/health', async (req, res) => {
    try {
        const authServiceStatus = await checkAuthService();
        const profileServiceStatus = await checkProfileService();

        res.json({
            status: 'up',
            details: {
                authService: authServiceStatus,
                profileService: profileServiceStatus,
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'down',
            error: error.message
        });
    }
});

// Ruta para verificar si el API Gateway está listo para recibir tráfico
app.get('/health/ready', async (req, res) => {
    try {
        const authServiceStatus = await checkAuthService();
        const profileServiceStatus = await checkProfileService();
        // Aquí podrías agregar cualquier otra comprobación de preparación necesaria

        res.json({
            status: 'ready',
            details: {
                authService: authServiceStatus,
                profileService: profileServiceStatus,
                // Cualquier otra comprobación
            }
        });
    } catch (error) {
        res.status(503).json({ // 503 Service Unavailable si no está listo
            status: 'not ready',
            error: error.message
        });
    }
});

// Ruta para verificar si el API Gateway está vivo
app.get('/health/live', (req, res) => {
    // Esta es una comprobación simple de liveness, por lo que simplemente respondemos con "alive"
    res.json({ status: 'alive' });
});



app.listen(PORT, () => {
    console.log(`API Gateway corriendo en el puerto ${PORT}`);
});
