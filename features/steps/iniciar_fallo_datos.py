import requests
from behave import given, when, then

# URL base de la API
base_url = "http://localhost:3000"

# Datos para la prueba
usuario_existente = {"nombre": "Mauricio", "contrasena": "", "email": ""}


# Paso 2: Verificar que existe un usuario con el correo y contraseña proporcionados
@given('un usuario no existente con correo "{email}" y contraseña "{contrasena}"')
def step_given_que_existe_un_usuario_con_correo_y_contrasena(
    context, email, contrasena
):
    # Realiza una solicitud GET a la API para buscar un usuario con los datos proporcionados
    response = requests.get(
        f"{context.base_url}/usuarios?email={usuario_existente['email']}"
    )

    # Verifica que la respuesta tenga un código de estado
    assert (
        response.status_code == 400
    ), f"Se esperaba el código -400, pero se obtuvo {response.status_code}"

    context.user_response = response


# Paso 3: Enviar una solicitud POST a "/sesion" con los datos de inicio de sesión
@when(
    'se envía una solicitud POST a "/sesion" con los datos vacios de inicio de sesión'
)
def step_when_se_envia_una_solicitud_post_a_sesion_con_los_datos_de_inicio_de_sesion(
    context,
):
    data = {
        "email": usuario_existente["email"],
        "contrasena": usuario_existente["contrasena"],
    }
    response = requests.post(f"{context.base_url}/sesion", json=data)
    context.response = response


# Paso 5: Verificar el mensaje en la respuesta
@then('la respuesta debe contener el mensaje fallido "{expected_message}"')
def step_and_la_respuesta_debe_contener_el_mensaje_fallido(context, expected_message):
    data = context.response.json()
    expected_message = "Email y contraseña son obligatorios"
    assert (
        "error" in data and expected_message in data["error"]
    ), f"El mensaje esperado '{expected_message}' no se encuentra en la respuesta: {data}"


@then("la respuesta debe contener un token jwt invalido")
def step_then_la_respuesta_debe_contener_un_token_jwt_valido(context):
    data = context.response.json()
    assert "token" in data, "La respuesta no contiene un token de sesión"
    context.session_token = data["token"]

    token = context.session_token
    with open("token_error.txt", "w") as file:
        file.write(token)
