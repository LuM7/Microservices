import requests
from behave import given, when, then

# URL base de la API
base_url = 'http://localhost:3000'

# Datos para la prueba
usuario_nuevo = {
    "nombre": "Mauricio",
    "contrasena": "125454",
    "email": "mau@gmail.com"
}

# Paso 1: Verificar que la API esté en funcionamiento
@given('que la api está en funcionamiento')
def step_given_que_la_api_esta_en_funcionamiento(context):
    context.base_url = base_url

# Paso 2: Verificar que el correo no exista en la base de datos
@given('que el correo no exista')
def step_given_que_el_correo_no_exista(context):
    # Realiza una solicitud GET a la API para verificar si el correo ya existe
    response = requests.get(f"{context.base_url}/usuarios?email={usuario_nuevo['email']}")
    
    # Verifica que la respuesta tenga un código de estado 200
    assert response.status_code == 200, f"Se esperaba el código 200, pero se obtuvo {response.status_code}"
    
    # Verifica que la respuesta no contenga datos de usuarios (es decir, que el correo no existe)
    data = response.json()
    
    # Si la respuesta es una lista de usuarios, verifica que la lista esté vacía
    if isinstance(data, list):
        assert len(data) == 0, f"El correo '{usuario_nuevo['email']}' ya existe en la base de datos"
    else:
        # Si la respuesta no es una lista, verifica que no contenga el correo
        assert usuario_nuevo['email'] not in data, f"El correo '{usuario_nuevo['email']}' ya existe en la base de datos"

# Paso 3: Enviar una solicitud POST a "/usuarios" con los datos proporcionados
@when('se envía una solicitud POST a "/usuarios" con los datos necesarios')
def step_when_se_envia_una_solicitud_post_a_usuarios(context):
    response = requests.post(f"{context.base_url}/usuarios", json=usuario_nuevo)
    context.response = response

# Paso 4: Verificar el código de estado de la respuesta
@then('la respuesta debe tener un código de estado {expected_status_code:d}')
def step_then_la_respuesta_debe_tener_un_codigo_de_estado(context, expected_status_code):
    assert context.response.status_code == expected_status_code, f"Se esperaba el código {expected_status_code}, pero se obtuvo {context.response.status_code}"

# Paso 5: Verificar el mensaje en la respuesta
@then('la respuesta debe contener el mensaje "{expected_message}"')
def step_and_la_respuesta_debe_contener_el_mensaje(context, expected_message):
    data = context.response.json()
    assert expected_message in data['message'], f"El mensaje esperado '{expected_message}' no se encuentra en la respuesta: {data['message']}"
