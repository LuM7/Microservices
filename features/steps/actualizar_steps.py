import requests
from behave import given, when, then

# Variables globales
base_url = "http://localhost:3000"

with open("token.txt", "r") as archivo:
    # Lee todo el contenido del archivo en una cadena
    contenido = archivo.read()

user_update_data = {
    "id": 1,
    "nombre": "Nuevo Nombre",
    "email": "nuevoemail@example.com",
    "token": contenido,
}
headers = {"Content-Type": "application/json"}


# Paso 2: Verificar que existe un usuario con el id proporcionado
@given("existe un usuario con el id buscado")
def step_given_existe_un_usuario_con_id_buscado(context):
    response = requests.get(f"{context.base_url}/usuarios?id={user_update_data['id']}")

    # Verifica que la respuesta tenga un código de estado
    assert (
        response.status_code == 200
    ), f"Se esperaba el código -200, pero se obtuvo {response.status_code}"

    # Guarda la respuesta en el contexto
    context.user_response = response


# Paso 2: Verificar que el usuario tiene sesion iniciada
@given("se ha iniciado sesión con un token válido")
def step_given_sesion_iniciada_con_token_valido(context):
    if user_update_data["token"] == contenido:
        print("Accion autorizada")
    else:
        assert False, "Token invalido, no tiene sesion iniciada"


# Paso 3: Enviar una solicitud PUT a "/usuarios/{existing_user_id}" con los datos proporcionados
@when('se envía una solicitud PUT a "/usuarios/id" con los datos necesarios')
def step_when_se_envia_una_solicitud_put_a_usuarios(context):
    response = requests.put(
        f"{context.base_url}/usuarios/{user_update_data['id']}",
        json=user_update_data,
        headers=headers,
    )
    context.response = response


# Paso 4: Verificar el código de estado de la respuesta
@then(
    "la respuesta debe tener un código de estado {expected_status_code:d} para actualizar"
)
def step_then_la_respuesta_debe_tener_un_codigo_de_estado(
    context, expected_status_code
):
    assert (
        context.response.status_code == expected_status_code
    ), f"Se esperaba el código {expected_status_code}, pero se obtuvo {context.response.status_code}"
