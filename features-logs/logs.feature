Feature: API de Logs centralizados

  La API de Logs centralizados permite la creación, consulta y manejo de registros de logs. 
  Cada escenario representa un método exitoso de la API.

  Scenario: Obtener todos los logs
    Given el servicio de logs está operativo
    When realizo una solicitud GET a "/logs" con parámetros de paginación opcionales
    Then recibo una respuesta exitosa con una lista de logs

  Scenario: Crear un nuevo log
    Given el servicio de logs está operativo
    And tengo un objeto log con todos los campos requeridos
    When realizo una solicitud POST a "/logs" con el objeto log
    Then recibo una respuesta de confirmación de creación del log

  Scenario: Obtener todos los logs de una aplicación específica
    Given el servicio de logs está operativo
    And tengo el nombre de una aplicación específica
    When realizo una solicitud GET a "/logs/{application}" con el nombre de la aplicación
    And uso parámetros de paginación opcionales
    Then recibo una respuesta exitosa con los logs de esa aplicación

  Scenario: Verificar el estado general del servicio (Health Check)
    Given el servicio de logs está operativo
    When realizo una solicitud GET a "/health"
    Then recibo una respuesta indicando que el servicio está UP

  Scenario: Comprobación de vitalidad del servicio (Liveness Check)
    Given el servicio de logs está operativo
    When realizo una solicitud GET a "/health/live"
    Then recibo una respuesta indicando que el servicio está ALIVE

  Scenario: Comprobación de preparación del servicio (Readiness Check)
    Given el servicio de logs está operativo
    When realizo una solicitud GET a "/health/ready"
    Then recibo una respuesta indicando que el servicio está READY
