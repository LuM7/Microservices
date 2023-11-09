from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

# Esta es la URL de la API de seguridad donde se realizarán las autenticaciones.
SECURITY_API_URL = "http://localhost:3000"


@app.route("/sesion", methods=["POST"])
def sesion():
    # Obtener el JSON del cuerpo de la solicitud.
    auth_data = request.json

    # Redireccionar la solicitud a la API de seguridad.
    response = requests.post(SECURITY_API_URL, json=auth_data)

    # Devolver la respuesta de la API de seguridad al cliente.
    return jsonify(response.json()), response.status_code


# inicia el servidor.
if __name__ == "__main__":
    app.run(debug=True, port=5000)
