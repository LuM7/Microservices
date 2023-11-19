Feature: Gestion de usuarios API

  Scenario: Crear un nuevo ususario con éxito
    Given que la api está en funcionamiento
    And que el correo no exista
    When se envía una solicitud POST a "/usuarios" con los datos necesarios
    Then la respuesta debe tener un código de estado 200
    And la respuesta debe contener el mensaje "Usuario agregado con éxito"

  Scenario: Obtener todos los usuarios con éxito
    Given que la api está en funcionamiento
    When se realiza una solicitud GET a "/usuarios"
    Then la respuesta debe tener un código de estado 200
    And la respuesta debe contener la lista de usuarios
    And imprimir la lista de usuarios en la consola

Scenario: Inicio de sesión exitoso
    Given que la api está en funcionamiento
    And un usuario existente con correo "{existing_user_email}" y contraseña "{existing_user_password}"
    When se envía una solicitud POST a "/sesion" con los datos de inicio de sesión
    Then la respuesta debe tener un código de estado 200 para iniciar sesion
    And la respuesta debe contener el mensaje "Inicio de sesión exitoso"
    And la respuesta debe contener un token jwt válido

Scenario: Inicio de sesión fallido
    Given que la api está en funcionamiento
    When se envía una solicitud POST a "/sesion" con los datos vacios de inicio de sesión
    Then la respuesta debe tener un código de estado 400 para iniciar sesion
    And la respuesta debe contener el mensaje fallido "Email y contraseña son obligatorios"

Scenario: Actualizar datos de un usuario con éxito
    Given que la api está en funcionamiento
    And se ha iniciado sesión con un token válido
    And existe un usuario con el id buscado
    When se envía una solicitud PUT a "/usuarios/id" con los datos necesarios
    Then la respuesta debe tener un código de estado 200 para actualizar
    And la respuesta debe contener el mensaje "Datos de usuario actualizados con éxito"


Scenario: Eliminar un usuario existente con éxito
    Given que la api está en funcionamiento
    And existe un usuario con el id buscado para eliminar
    And se ha iniciado sesión con un token válido para eliminar
    When se envía una solicitud DELETE a "/usuarios/id"
    Then la respuesta debe tener un código de estado 200 para eliminar
    And la respuesta debe contener el mensaje "Usuario eliminado con éxito"

