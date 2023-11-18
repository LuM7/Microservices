const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const PORT = 3003;
const SERVICIO_AUTENTICACION_URL = 'http://app:3000';
const SERVICIO_PERFIL_URL = 'http://perfil:3002';
const verificarToken = require('./verificarToken');



// Función para unificar respuestas
async function unificarRespuestas(respuestas) {
    let respuestaUnificada = {};

    for (let respuesta of respuestas) {
        if (respuesta.status >= 200 && respuesta.status < 300) {
            respuestaUnificada = { ...respuestaUnificada, ...respuesta.data };
        } else {
            console.error("Error en una solicitud: ", respuesta);
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
        res.status(error.response.status).json(error.response.data);
    }
});

app.post('/usuarios', async (req, res) => {
    try {
        const response = await axios.post(`${SERVICIO_AUTENTICACION_URL}/usuarios`, req.body);
        res.json(response.data);
    } catch (error) {
        res.status(error.response.status).json(error.response.data);
    }
});

// Rutas para actualizar y consultar datos de usuario
app.put('/usuario/:id', verificarToken, async (req, res) => {
    try {
        const userId = req.params.id;
        const { nombre, email, contrasena, ...datosPerfil } = req.body;
        const respuestaAutenticacion = await axios.put(`${SERVICIO_AUTENTICACION_URL}/usuarios/${userId}`, { nombre, email, contrasena });
        const respuestaPerfil = await axios.put(`${SERVICIO_PERFIL_URL}/perfil/${userId}`, datosPerfil);

        const respuestaUnificada = await unificarRespuestas([respuestaAutenticacion, respuestaPerfil]);
        res.json(respuestaUnificada);
    } catch (error) {
        res.status(500).json({ error: "Error al actualizar la información del usuario" });
    }
});

app.get('/usuario/:id', verificarToken, async (req, res) => {
    try {
        const userId = req.params.id;

        const respuestaAutenticacion = await axios.get(`${SERVICIO_AUTENTICACION_URL}/usuarios/${userId}`);
        const respuestaPerfil = await axios.get(`${SERVICIO_PERFIL_URL}/perfil/${userId}`);

        const respuestaUnificada = await unificarRespuestas([respuestaAutenticacion, respuestaPerfil]);
        res.json(respuestaUnificada);
    } catch (error) {
        res.status(500).json({ error: "Error al consultar la información del usuario" });
    }
});

app.listen(PORT, () => {
    console.log(`API Gateway corriendo en el puerto ${PORT}`);
});
