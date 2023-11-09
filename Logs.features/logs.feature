Feature: Sistema de gestión de Logs 

Scenario: Crear un nuevo registro de log con éxito
  Given que el servicio de redis este activo y el gestor de logs está en funcionamiento
  When se envía una solicitud POST a "/logs" con los datos necesarios
  Then la respuesta debe tener un código de estado 200
  And la respuesta debe contener el mensaje "Registro de log creado con éxito"
