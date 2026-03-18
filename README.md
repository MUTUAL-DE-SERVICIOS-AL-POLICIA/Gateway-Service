# Gateway-Service

## Descripción

**Gateway-Service** es el microservicio que actúa como punto de entrada principal de la plataforma. Orquesta y enruta todas las solicitudes HTTP hacia los microservicios backend.

Funcionalidades principales:
- Enrutamiento centralizado de solicitudes HTTP
- Control de autenticación y autorización
- Agregación de datos de múltiples microservicios
- Integración con servicios externos (SMS, WhatsApp)
- Gestión de transacciones distribuidas
- Balanceo de carga y manejo de errores

---

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
