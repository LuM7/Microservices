import requests
from behave import given, when, then

# URL base de la API
base_url = "http://localhost:3000"

# Datos para la prueba
usuario_existente = {
    "nombre": "Mauricio",
    "contrasena": "125454",
    "email": "mau@gmail.com",
}


# Paso 2: Verificar que existe un usuario con el correo y contraseña proporcionados
@given('un usuario existente con correo "{email}" y contraseña "{contrasena}"')
def step_given_que_existe_un_usuario_con_correo_y_contrasena(
    context, email, contrasena
):
    # Realiza una solicitud GET a la API para buscar un usuario con los datos proporcionados
    response = requests.get(
        f"{context.base_url}/usuarios?email={usuario_existente['email']}"
    )

    # Verifica que la respuesta tenga un código de estado
    assert (
        response.status_code == 200
    ), f"Se esperaba el código -200, pero se obtuvo {response.status_code}"

    # Guarda el usuario encontrado en el contexto si existe
    data = response.json()
    if isinstance(data, list):
        for user in data:
            if user["email"] == email and user["contrasena"] == contrasena:
                context.existing_user = user
                break
        else:
            assert (
                False
            ), f"No se encontró un usuario con correo '{email}' y contraseña '{contrasena}'"
    elif isinstance(data, dict):
        context.existing_user = data
    else:
        assert False, "La respuesta no contiene datos de usuarios válidos"


# Paso 3: Enviar una solicitud POST a "/sesion" con los datos de inicio de sesión
@when('se envía una solicitud POST a "/sesion" con los datos de inicio de sesión')
def step_when_se_envia_una_solicitud_post_a_sesion_con_los_datos_de_inicio_de_sesion(
    context,
):
    data = {
        "email": usuario_existente["email"],
        "contrasena": usuario_existente["contrasena"],
    }
    response = requests.post(f"{context.base_url}/sesion", json=data)
    context.response = response


# Paso 4: Verificar el código de estado de la respuesta para inicio de sesión
@then(
    "la respuesta debe tener un código de estado {expected_status_code:d} para iniciar sesion"
)
def step_then_la_respuesta_debe_tener_un_codigo_de_estado(
    context, expected_status_code
):
    assert (
        context.response.status_code == expected_status_code
    ), f"Se esperaba el código {expected_status_code}, pero se obtuvo {context.response.status_code}"


@then("la respuesta debe contener un token jwt válido")
def step_then_la_respuesta_debe_contener_un_token_jwt_valido(context):
    data = context.response.json()
    assert "token" in data, "La respuesta no contiene un token de sesión"
    context.session_token = data["token"]

    token = context.session_token
    with open("token.txt", "w") as file:
        file.write(token)
    print(f"Token de sesión guardado en el archivo 'token.txt'")
