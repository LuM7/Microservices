# test_logs_api.py

from behave import given, when, then
import requests

@given('el servicio de logs está operativo')
def step_impl(context):
    response = requests.get(context.base_url + '/health')
    assert response.status_code == 200
    assert response.json()['status'] == 'UP'

@when('realizo una solicitud GET a "/logs" con parámetros de paginación opcionales')
def step_impl(context):
    context.response = requests.get(context.base_url + '/logs', params={'page': 1, 'perPage': 10})

@then('recibo una respuesta exitosa con una lista de logs')
def step_impl(context):
    assert context.response.status_code == 200
    data = context.response.json()
    assert 'logs' in data
    assert isinstance(data['logs'], list)

@given('tengo un objeto log con todos los campos requeridos')
def step_impl(context):
    context.log_data = {
        "application": "TestApp",
        "tipo_log": "INFO",
        "modulo": "TestModule",
        "resumen": "TestSummary",
        "descripcion": "TestDescription"
    }

@when('realizo una solicitud POST a "/logs" con el objeto log')
def step_impl(context):
    context.response = requests.post(context.base_url + '/logs', json=context.log_data)

@then('recibo una respuesta de confirmación de creación del log')
def step_impl(context):
    assert context.response.status_code == 200
    response_data = context.response.json()
    assert 'message' in response_data
    assert response_data['message'] == 'Registro de log creado con éxito'

@given('tengo el nombre de una aplicación específica')
def step_impl(context):
    context.application_name = "TestApp"

@when('realizo una solicitud GET a "/logs/{application}" con el nombre de la aplicación')
def step_impl(context):
    context.response = requests.get(f"{context.base_url}/logs/{context.application_name}", params={'page': 1, 'perPage': 10})

@then('recibo una respuesta exitosa con los logs de esa aplicación')
def step_impl(context):
    assert context.response.status_code == 200
    data = context.response.json()
    assert 'logs' in data
    assert isinstance(data['logs'], list)


