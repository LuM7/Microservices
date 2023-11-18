const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const PORT = 3003;
const AUTH_SERVICE_URL = 'http://app:3000';

app.post('/sesion', async (req, res) => {
    try {
        const response = await axios.post(`${AUTH_SERVICE_URL}/sesion`, req.body);
        res.json(response.data);
    } catch (error) {
        res.status(error.response.status).json(error.response.data);
    }
});

app.post('/usuarios', async (req, res) => {
    try {
        const response = await axios.post(`${AUTH_SERVICE_URL}/usuarios`, req.body);
        res.json(response.data);
    } catch (error) {
        res.status(error.response.status).json(error.response.data);
    }
});

app.listen(PORT, () => {
    console.log(`API Gateway corriendo en el puerto ${PORT}`);
});
