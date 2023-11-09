import requests
from behave import given, when, then

# URL base de la API de logs
base_url = 'http://localhost:4002'

# Datos para la prueba
log_data = {
    "application": "TestApp",
    "tipoLog": "Test",
    "modulo": "Modulo de Prueba",
    "resumen": "Crea un log de prueba",
    "descripcion": "Log de prueba para probar la creación de logs",
}

response = None

# Paso 1: Verificar que el servicio de redis esté activo y el gestor de logs esté en funcionamiento
@given('que el servicio de redis este activo y el gestor de logs está en funcionamiento')
def step_given_service_and_logs_are_running(context):
    # Aquí puedes verificar que el servicio de redis y el gestor de logs estén en funcionamiento.
    # Esto puede incluir la verificación de conexiones, estado de servicios, etc.
    pass

# Paso 2: Enviar una solicitud POST a "/logs" con los datos proporcionados
@when('se envía una solicitud POST a "/logs" con los datos necesarios')
def step_when_send_post_request(context):
    global response
    response = requests.post(f"{base_url}/logs", json=log_data)

# Paso 3: Verificar el código de estado de la respuesta
@then('la respuesta debe tener un código de estado {expected_status_code:d}')
def step_then_check_status_code(context, expected_status_code):
    assert response.status_code == expected_status_code

# Paso 4: Verificar el mensaje en la respuesta
@then('la respuesta debe contener el mensaje "{expected_message}"')
def step_and_check_response_message(context, expected_message):
    data = response.json()
    assert expected_message in data['message']

# Paso 5: Opcional - Limpiar cualquier estado o realizar acciones posteriores
@given('que se han completado las pruebas de logs')
def step_given_cleanup(context):
    # Puedes agregar acciones de limpieza aquí, si es necesario.
    pass
