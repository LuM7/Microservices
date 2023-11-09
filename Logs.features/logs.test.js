// Importa las bibliotecas necesarias
const chai = require('chai');
const chaiHttp = require('chai-http');
const app = require('../consumidor');
const expect = chai.expect;

chai.use(chaiHttp);

describe('Sistema de Logs', function () {
    it('Debería obtener todos los logs', function (done) {
        chai.request(app)
            .get('/logs')
            .end(function (err, res) {
                expect(res).to.have.status(200);
                expect(res.body).to.be.an('object');
                expect(res.body).to.have.property('logs').that.is.an('array');
                done();
            });
    });

    it('Debería crear un nuevo log', function (done) {
        const newLog = {
            application: 'MiAplicacion',
            tipoLog: 'Información',
            modulo: 'Pruebas',
            resumen: 'Prueba exitosa',
            descripcion: 'Esta es una prueba exitosa de creación de log',
        };

        chai.request(app)
            .post('/logs')
            .send(newLog)
            .end(function (err, res) {
                expect(res).to.have.status(200);
                expect(res.body).to.be.an('object');
                expect(res.body).to.have.property('message').that.includes('creado con éxito');
                done();
            });
    });

    it('Debería filtrar los logs por aplicación', function (done) {
        const applicationName = 'app';

        chai.request(app)
            .get(`/logs/${applicationName}`)
            .end(function (err, res) {
                expect(res).to.have.status(200);
                expect(res.body).to.be.an('object');
                expect(res.body).to.have.property('logs').that.is.an('array');
                expect(res.body.logs).to.satisfy(logs => logs.every(log => log.application === applicationName));
                done();
            });
    });
});
