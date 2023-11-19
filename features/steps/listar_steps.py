import requests
from behave import given, when, then

# URL base de la API
base_url = 'http://localhost:3000'

# Paso 2: Realizar una solicitud GET a "/usuarios"
@when('se realiza una solicitud GET a "/usuarios"')
def step_when_se_realiza_una_solicitud_get_a_usuarios(context):
    response = requests.get(f"{context.base_url}/usuarios")
    context.response = response

# Paso 4: Verificar que la respuesta contenga la lista de usuarios
@then('la respuesta debe contener la lista de usuarios')
def step_then_la_respuesta_debe_contener_la_lista_de_usuarios(context):
    data = context.response.json()
    assert 'users' in data, "La respuesta no contiene la lista de usuarios"
    assert isinstance(data['users'], list), "La lista de usuarios no es una lista"

# Paso 5: Imprimir la lista de usuarios en un archivo txt
@then('imprimir la lista de usuarios en la consola')
def step_then_imprimir_la_lista_de_usuarios_en_un_archivo(context):
    data = context.response.json()
    
    # Verifica que la lista de usuarios exista en la respuesta
    assert 'users' in data, "La respuesta no contiene la lista de usuarios"
    
    # Obtiene la lista de usuarios
    users = data['users']
    
    # Define el nombre del archivo txt donde se imprimirá la lista
    file_name = 'lista_usuarios.txt'
    
    # Abre el archivo en modo escritura
    with open(file_name, 'w') as file:
        for user in users:
            # Escribe cada usuario en el archivo
            file.write(f"Id: {user['id']}, Nombre: {user['nombre']}, Email: {user['email']}\n")
    
    print(f"La lista de usuarios se ha guardado en el archivo '{file_name}'")
