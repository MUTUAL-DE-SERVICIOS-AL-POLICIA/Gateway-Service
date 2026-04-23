# Gateway-Service

## Descripción

**Gateway-Service** es el microservicio que actúa como **punto de entrada única (API Gateway)** principal de toda la plataforma. Orquesta, enruta y valida todas las solicitudes HTTP provenientes de clientes (aplicaciones móviles, web, kioscos) hacia los microservicios backend correspondientes. Es la cara pública de la plataforma, responsable de garantizar seguridad, disponibilidad y rendimiento. Forma parte de una arquitectura de microservicios basada en **NestJS** y utiliza **NATS** para la comunicación asincrónica con otros servicios.

Funcionalidades principales:
- **Enrutamiento centralizado**: Dirigir solicitudes HTTP al microservicio correcto según la ruta
- **Autenticación y autorización**: Validar tokens JWT y permisos antes de permitir acceso
- **Agregación de datos**: Combinar respuestas de múltiples microservicios en una sola respuesta
- **Integración con servicios externos**: SMS, WhatsApp, APIs privadas de backends externos
- **Balanceo de carga**: Distribuir solicitudes entre instancias de microservicios
- **Manejo de errores centralizado**: Capturar y formatear errores consistentemente
- **Rate limiting y throttling**: Controlar flujo de solicitudes para proteger la plataforma
- **Logging y auditoría**: Registrar todas las solicitudes para debugging y seguridad
- **Gestión de CORS**: Control de acceso cruzado desde diferentes dominios frontend



## Clonar el repositorio y agregarle un nombre nuevo del nuevo proyecto

```bash
git clone https://github.com/MUTUAL-DE-SERVICIOS-AL-POLICIA/Gateway-Service.git nombre-gateway-service
```

## Inicializar proyecto

```bash
# Entrar al repositorio clonado con el nuevo nombre del proyecto
cd nombre-gateway-service

# Elimina el origen remoto actual
git remote remove origin

# Crear el archivo .env en base al .env.template
cp .env.template .env

# Instalar las dependencias
pnpm install

# Correr proyecto en modo desarrollo
pnpm start:dev

# Crear nuevo Módulo
nest g res nombreModulo

# Crear un seeder
pnpm seed:create --name src/database/seeds/nombre_seed.ts

# Correr seeder
pnpm seed:run --name src/database/seeds/{code}-nombre_seed.ts

# Crear migración
pnpm typeorm migration:create src/database/migrations/NombreDeLaMigración

# Correr migración
pnpm migration:run

# Revertir migración
pnpm migration:revert

# Ver estado de migraciones
pnpm migration:show

# Para enlazar a un nuevo repositorio
git remote add origin https://github.com/tu-usuario/{nombre-gateway-service}.git
git add .
git commit -m "Inicialización del nuevo proyecto"
git branch -M main
git push -u origin main
```

---

## Requisitos Previos

### Levantar NATS (Message Broker)

```bash
docker run -d --name nats-server -p 4222:4222 -p 8222:8222 nats
```

### Microservicios dependientes

Asegúrate de tener corriendo:
- Auth-Service
- Contributions-Service
- Beneficiary-Service
- Loans-Service
- Records-Service
- Kiosk-Service
- Global-Service
- App-Mobile-Service

---

## Producción

### Compilar imagen Docker

```bash
docker build -f dockerfile.prod -t client-gateway .
```

### Ejecutar contenedor

```bash
docker run -d -p 3000:3000 client-gateway
```
