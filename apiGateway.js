const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const PORT = 3003;
const SERVICIO_AUTENTICACION_URL = 'http://app:3000';
const SERVICIO_PERFIL_URL = 'http://perfil:3002';

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
    } catch (error) {
        res.status(error.response ? error.response.status : 500).json(error.response ? error.response.data : { error: "Error al iniciar sesión" });
    }
});

app.post('/usuarios', async (req, res) => {
    try {
        const response = await axios.post(`${SERVICIO_AUTENTICACION_URL}/usuarios`, req.body);
        res.json(response.data);
    } catch (error) {
        res.status(error.response ? error.response.status : 500).json(error.response ? error.response.data : { error: "Error al crear usuario" });
    }
});

// Rutas para actualizar y consultar datos de usuario
// app.put('/usuario/:id', async (req, res) => {
//     const userId = req.params.id;
//     const token = req.headers['authorization'];
//     const { nombre, email, contrasena, ...datosPerfil } = req.body;

//     try {
//         // Verificar la autenticación del usuario
//         await verificarAutenticacion(userId, token);

//         // Respuestas de actualización del usuario y perfil
//         const respuestas = [];

//         // Si hay campos para actualizar el usuario
//         if (nombre || email || contrasena) {
//             const respuestaAutenticacion = await axios.put(`${SERVICIO_AUTENTICACION_URL}/usuarios/${userId}`, { nombre, email, contrasena });
//             respuestas.push(respuestaAutenticacion);
//         }

//         // Si hay campos para actualizar el perfil
//         if (Object.keys(datosPerfil).length > 0) {
//             const respuestaPerfil = await axios.put(`${SERVICIO_PERFIL_URL}/perfil/${userId}`, datosPerfil);
//             respuestas.push(respuestaPerfil);
//             console.log(`Token que se enviará al servicio de perfil: ${token}`);

//         }

//         // Unificar las respuestas y enviarlas
//         const respuestaUnificada = await unificarRespuestas(respuestas);
//         res.json(respuestaUnificada);
//     } catch (error) {
//         res.status(error.response ? error.response.status : 500).json(error.response ? error.response.data : { error: "Error al actualizar el usuario" });
//     }
// });
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

app.listen(PORT, () => {
    console.log(`API Gateway corriendo en el puerto ${PORT}`);
});
