package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"

	// "fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/dgrijalva/jwt-go"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis"
	_ "github.com/mattn/go-sqlite3"
)

const SecretKey = "tokenlogin2023"

// variables globales para el cliente de redis
var redisCliente *redis.Client

// Variables para establecer la conexión a la bd
var db *sql.DB

type PerfilUsuario struct {
	ID             int      `json:"id"`
	URLPersonal    string   `json:"url_personal"`
	Apodo          string   `json:"apodo"`
	InfoContacto   string   `json:"info_contacto"`
	Direccion      string   `json:"direccion"`
	Biografia      string   `json:"biografia"`
	Organizacion   string   `json:"organizacion"`
	PaisResidencia string   `json:"pais_residencia"`
	RedesSociales  []string `json:"redes_sociales"`
}

// @title Servicio de Gestión de Perfiles API
// @version 1
// @description Esta es una muestra de servidor PerfilUsuario.
// @host localhost:3002
// @BasePath /
func main() {
	var err error

	// Inicializamos el cliente de Redis
	redisCliente = redis.NewClient(&redis.Options{
		Addr:     "redis:6379", // nombre del servicio redis
		Password: "",
		DB:       0,
	})

	// abrir la conexión a la base de datos
	db, err = sql.Open("sqlite3", "perfil_usuario.db")
	if err != nil {
		log.Fatalf("Error al abrir la base de datos: %v", err)
	}
	defer db.Close()

	// Crear la tabla perfiles si no existe
	if err := crearTablaPerfiles(); err != nil {
		log.Fatalf("Error al crear la tabla de perfiles: %v", err)
	}

	r := gin.Default()
	// r.Static("/docs", "./docs")
	// r.GET("/swagger/swagger.json", func(c *gin.Context) {
	// 	c.File("./docs/swagger.json")
	// })

	// url := ginSwagger.URL("http://localhost:3002/swagger/swagger.json")
	// r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler, url))

	go escucharEventosRegistro()

	r.GET("/perfil/:id", obtenerPerfil)
	r.PUT("/perfil/:id", actualizarPerfil)
	r.GET("/perfiles", listarPerfiles)
	r.GET("/health", healthCheck)
	r.GET("/health/ready", healthReady)
	r.GET("/health/live", healthLive)

	r.Run(":3002") // Puerto  0.0.0.0:3002
}

func crearTablaPerfiles() error {
	// Create the profiles table if it doesn't exist
	_, err := db.Exec(`
        CREATE TABLE IF NOT EXISTS perfiles_usuarios (
            id INTEGER PRIMARY KEY,
            url_personal TEXT,
            apodo TEXT,
            info_contacto TEXT,
            direccion TEXT,
            biografia TEXT,
            organizacion TEXT,
            pais_residencia TEXT,
            redes_sociales TEXT
        );
    `)
	return err
}

// @Summary Obtener un perfil de usuario
// @Description obtiene el perfil de usuario por ID
// @ID obtener-perfil
// @Accept  json
// @Produce  json
// @Param id path int true "ID del Usuario"
// @Success 200 {object} PerfilUsuario
// @Router /perfil/{id} [get]
func obtenerPerfil(c *gin.Context) {
	userID := c.Param("id")

	var perfilUsuario PerfilUsuario
	var redesSocialesStr string // Usar una variable temporal para almacenar la cadena de texto de redes sociales

	query := "SELECT id, url_personal, apodo, info_contacto, direccion, biografia, organizacion, pais_residencia, redes_sociales FROM perfiles_usuarios WHERE id = ?"
	err := db.QueryRow(query, userID).Scan(
		&perfilUsuario.ID, &perfilUsuario.URLPersonal, &perfilUsuario.Apodo,
		&perfilUsuario.InfoContacto, &perfilUsuario.Direccion,
		&perfilUsuario.Biografia, &perfilUsuario.Organizacion,
		&perfilUsuario.PaisResidencia, &redesSocialesStr, // Almacenar las redes sociales como una cadena de texto
	)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Usuario no encontrado"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al consultar la base de datos"})
		}
		return
	}

	// Convertir la cadena de texto de redes sociales a un slice
	perfilUsuario.RedesSociales = strings.Split(redesSocialesStr, ",")

	// Registrar la operación en el sistema de logs
	registrarInvocacion("Perfil", "Consulta", "Perfil", "Perfil obtenido", "Se ha consultado el perfil con ID "+userID)

	c.JSON(http.StatusOK, perfilUsuario)
}

// ListarPerfiles lista todos los perfiles de usuario
// @Summary Lista todos los perfiles de usuario
// @Description Devuelve un arreglo de todos los perfiles de usuario
// @Tags perfiles
// @Accept json
// @Produce json
// @Success 200 {array} PerfilUsuario
// @Failure 500 {object} HTTPError "Error al recuperar los perfiles"
// @Router /perfiles [get]
func listarPerfiles(c *gin.Context) {
	// Realiza una consulta SQL para obtener todos los perfiles
	query := "SELECT id, url_personal, apodo, info_contacto, direccion, biografia, organizacion, pais_residencia, redes_sociales FROM perfiles_usuarios"
	rows, err := db.Query(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al recuperar los perfiles"})
		return
	}
	defer rows.Close()

	// Crea una lista para almacenar los perfiles
	var perfiles []PerfilUsuario

	for rows.Next() {
		var perfilUsuario PerfilUsuario
		var redesSocialesStr string // Usar una variable temporal para almacenar la cadena de texto de redes sociales

		err = rows.Scan(
			&perfilUsuario.ID, &perfilUsuario.URLPersonal, &perfilUsuario.Apodo,
			&perfilUsuario.InfoContacto, &perfilUsuario.Direccion,
			&perfilUsuario.Biografia, &perfilUsuario.Organizacion,
			&perfilUsuario.PaisResidencia, &redesSocialesStr, // Almacenar las redes sociales como una cadena de texto
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al listar los perfiles"})
			return
		}
		// Convertir la cadena de texto de redes sociales a un slice
		perfilUsuario.RedesSociales = strings.Split(redesSocialesStr, ",")
		perfiles = append(perfiles, perfilUsuario)
	}
	// Registrar la operación en el sistema de logs
	//registrarInvocacion("Perfil", "Listado", "Perfil", "Perfiles listados", "Se ha realizado un listado de todos los perfiles")

	c.JSON(http.StatusOK, perfiles)
}

func registrarInvocacion(aplicacion, tipoLog, modulo, resumen, descripcion string) {
	// Asegúrate de que `aplicacion` no sea nulo o vacío
	if aplicacion == "" {
		log.Println("El nombre de la aplicación no puede estar vacío")
		return
	}

	logData := map[string]interface{}{
		"application": aplicacion,
		"fecha_hora":  time.Now().Format("2006-01-02 15:04:05"),
		"tipo_log":    tipoLog,
		"modulo":      modulo,
		"resumen":     resumen,
		"descripcion": descripcion,
	}

	logJSON, err := json.Marshal(logData)
	if err != nil {
		log.Printf("Error al serializar los datos del log: %v", err)
		return
	}

	// Publicar en el canal de Redis
	err = redisCliente.Publish("canal-logs", string(logJSON)).Err()
	if err != nil {
		log.Printf("Error al publicar en el canal de logs: %v", err)
		return
	}
}

func escucharEventosRegistro() {
	pubsub := redisCliente.Subscribe("canal-registro-usuario")
	defer pubsub.Close()

	ch := pubsub.Channel()
	for msg := range ch {
		// Procesar el mensaje recibido
		var evento map[string]interface{}
		if err := json.Unmarshal([]byte(msg.Payload), &evento); err != nil {
			log.Printf("Error al decodificar el mensaje de registro de usuario: %v", err)
			continue
		}

		// Asignar el ID del usuario al perfil y crear un perfil predeterminado
		if evento["type"] == "USER_REGISTERED" {
			fmt.Printf("Evento recibido: %+v\n", evento)

			// Comprobar primero si el valor de userId existe y no es nil
			if userId, ok := evento["userId"]; ok && userId != nil {
				// Intentar convertir userId a float64 y luego a int
				if userIdFloat, ok := userId.(float64); ok {
					userIdInt := int(userIdFloat)
					crearPerfilPredeterminado(userIdInt)
				} else {
					log.Printf("Error al convertir userId a int: %v", userId)
				}
			} else {
				log.Printf("userId es nil o no existe en el evento")
			}
		}
		if evento["type"] == "USER_DELETED" {
			// Manejar la eliminación del perfil asociado al usuario
			if userId, ok := evento["userId"]; ok && userId != nil {
				fmt.Printf("Tipo de userId antes de la conversión: %T\n", userId)
				if userIdStr, ok := userId.(string); ok {
					// Convertir el userId de string a int
					userIdInt, err := strconv.Atoi(userIdStr)
					if err != nil {
						log.Printf("Error al convertir userId a int: %v", err)
						continue // Salir del bucle actual y esperar el siguiente mensaje
					}
					eliminarPerfil(userIdInt)
				} else {
					log.Printf("Error: userId no es un string: %v", userId)
				}
			} else {
				log.Printf("userId es nil o no existe en el evento")
			}
		}

	}
}

// ActualizarPerfil actualiza el perfil de un usuario
// @Summary Actualizar un perfil de usuario
// @Description Actualiza los datos del perfil de usuario basándose en el id proporcionado
// @Tags perfil
// @Accept json
// @Produce json
// @Param Authorization header string true "Token de autenticación"
// @Param id path int true "ID del Usuario"
// @Param perfil body PerfilUsuario true "Datos del perfil a actualizar"
// @Success 200 {object} HTTPSuccess "Perfil actualizado con éxito"
// @Failure 400 {object} HTTPError "Datos de perfil no válidos"
// @Failure 401 {object} HTTPError "Token no válido"
// @Failure 403 {object} HTTPError "No tienes permiso para actualizar este perfil"
// @Failure 500 {object} HTTPError "Error al actualizar el perfil"
// @Router /perfil/{id} [put]
func actualizarPerfil(c *gin.Context) {
	// Obtener el token de la cabecera Authorization
	tokenString := c.GetHeader("Authorization")
	log.Printf("Token recibido: '%s'", tokenString)

	// Quitar el prefijo "Bearer " si está presente
	tokenString = strings.TrimPrefix(tokenString, "Bearer ")

	// Validar el token
	token, err := validarToken(tokenString)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Token no válido"})
		return
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Token no válido"})
		return
	}

	// Asegúrate de que el ID del usuario en el token coincide con el ID en la ruta
	userID, err := strconv.Atoi(c.Param("id"))
	if err != nil || int(claims["userId"].(float64)) != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "No tienes permiso para actualizar este perfil"})
		return
	}

	var datosPerfil PerfilUsuario
	if err := c.ShouldBindJSON(&datosPerfil); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos de perfil no válidos"})
		return
	}

	// Llama a la función que actualiza el perfil en la base de datos
	err = actualizarPerfilEnDB(userID, datosPerfil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al actualizar el perfil"})
		return
	}

	// Si todo sale bien, enviar una respuesta indicando el éxito de la operación
	c.JSON(http.StatusOK, gin.H{"message": "Perfil actualizado con éxito"})
}

// función que actualiza el perfil en la base de datos
func actualizarPerfilEnDB(userID int, datosPerfil PerfilUsuario) error {
	// Convertir la lista de redes sociales en una cadena separada por comas para almacenarla en la base de datos
	redesSocialesStr := strings.Join(datosPerfil.RedesSociales, ",")

	// Preparar la consulta SQL para actualizar el perfil
	query := `
        UPDATE perfiles_usuarios SET
            url_personal = ?, 
            apodo = ?, 
            info_contacto = ?, 
            direccion = ?, 
            biografia = ?, 
            organizacion = ?, 
            pais_residencia = ?, 
            redes_sociales = ?
        WHERE id = ?
    `

	// Ejecutar la consulta SQL con los datos proporcionados para actualizar el perfil
	_, err := db.Exec(query, datosPerfil.URLPersonal, datosPerfil.Apodo, datosPerfil.InfoContacto, datosPerfil.Direccion,
		datosPerfil.Biografia, datosPerfil.Organizacion, datosPerfil.PaisResidencia, redesSocialesStr, userID)

	if err != nil {
		// Manejar el error de la base de datos
		return err
	}

	// Si todo sale bien, devolver nil para indicar que no hubo errores
	return nil
}

func crearPerfilPredeterminado(id int) {
	// Aquí definirías los valores predeterminados para el perfil del usuario
	perfilPredeterminado := PerfilUsuario{
		URLPersonal:    "",
		Apodo:          "",
		InfoContacto:   "",
		Direccion:      "",
		Biografia:      "",
		Organizacion:   "",
		PaisResidencia: "",
		RedesSociales:  []string{},
	}

	// Realizar la inserción en la base de datos incluyendo el ID
	query := `
        INSERT INTO perfiles_usuarios (id, url_personal, apodo, info_contacto, direccion, biografia, organizacion, pais_residencia, redes_sociales)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
	// Usamos `id` como el primer parámetro para `db.Exec`
	_, err := db.Exec(query, id, perfilPredeterminado.URLPersonal, perfilPredeterminado.Apodo, perfilPredeterminado.InfoContacto, perfilPredeterminado.Direccion, perfilPredeterminado.Biografia, perfilPredeterminado.Organizacion, perfilPredeterminado.PaisResidencia, strings.Join(perfilPredeterminado.RedesSociales, ","))
	if err != nil {
		log.Printf("Error al crear el perfil predeterminado: %v", err)
		return
	}

	mensaje := fmt.Sprintf("Se creó un perfil para el usuario %v", id)
	registrarInvocacion("Perfil", "Creacion Perfil", "Perfil", "Se ha creado un perfil predeterminado", mensaje)

}

func eliminarPerfil(userID int) {
	query := "DELETE FROM perfiles_usuarios WHERE id = ?"
	_, err := db.Exec(query, userID)
	if err != nil {
		log.Printf("Error al eliminar el perfil del usuario %d: %v", userID, err)
		return
	}

	mensaje := fmt.Sprintf("Perfil del usuario %d eliminado con éxito", userID)
	registrarInvocacion("Perfil", "Eliminación Perfil", "Perfil", "Perfil eliminado", mensaje)
}

func validarToken(tokenString string) (*jwt.Token, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("método de firma inesperado: %v", token.Header["alg"])
		}
		return []byte(SecretKey), nil
	})

	if err != nil {
		fmt.Println(err)
		return nil, err
	}

	if token == nil {
		return nil, errors.New("el token no pudo ser parseado o es inválido")
	}

	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		// Aquí puedes manejar las claims del token
		fmt.Println(claims["userId"])
	} else {
		fmt.Println(err)
		return nil, err
	}

	return token, nil
}

// Health Check general

// HealthCheck informa el estado general del servicio
// @Summary Verificar el estado general del servicio
// @Description Indica si el servicio está arriba sin verificar dependencias
// @Tags salud
// @Produce json
// @Success 200 {object} HealthStatus "Servicio en funcionamiento"
// @Router /health [get]
func healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "UP"})
}

// Health Check de readiness
// HealthReady verifica la preparación del servicio para manejar tráfico
// @Summary Verificar el estado de readiness del servicio
// @Description Verifica si las dependencias del servicio están listas para manejar tráfico
// @Tags salud
// @Produce json
// @Success 200 {object} HealthStatus "Servicio listo para manejar tráfico"
// @Failure 500 {object} HealthStatus "Servicio no está listo para manejar tráfico"
// @Router /health/ready [get]
func healthReady(c *gin.Context) {
	// Verificar la conexión a la base de datos
	if err := db.Ping(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "DOWN", "error": "Database not ready"})
		return
	}

	// Verificar la conexión a Redis
	if _, err := redisCliente.Ping().Result(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "DOWN", "error": "Redis not ready"})
		return
	}

	// Si todo está bien
	c.JSON(http.StatusOK, gin.H{"status": "READY"})
}

// Health Check de liveness

// HealthLive verifica si el servicio está vivo
// @Summary Verificar el estado de liveness del servicio
// @Description Indica si el servicio está vivo y corriendo
// @Tags salud
// @Produce json
// @Success 200 {object} HealthStatus "Servicio vivo y corriendo"
// @Router /health/live [get]
func healthLive(c *gin.Context) {
	// Aquí simplemente devuelves que el servicio está vivo
	c.JSON(http.StatusOK, gin.H{"status": "ALIVE"})
}

// HealthStatus es el esquema común para los estados de salud
type HealthStatus struct {
	Status string `json:"status"`
	Error  string `json:"error,omitempty"`
}

// HTTPError representa un error de la API
type HTTPError struct {
	Error string `json:"error"`
}

// HTTPSuccess representa una respuesta exitosa
type HTTPSuccess struct {
	Message string `json:"message"`
}
