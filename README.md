# Chat SaaS funcional

Proyecto basado en el chat inicial, ampliado con autenticación, gestión de tickets y gestión de tareas.

## Requisitos
- Node.js 20 o superior
- Una base de datos MongoDB Atlas

## Ejecutar localmente
1. Instala Node.js si no lo tienes.
2. Abre una terminal en esta carpeta.
3. Ejecuta `npm install`.
4. Crea un archivo `.env` copiando `.env.example`.
5. En `.env`, coloca tu URI de MongoDB Atlas en `MONGODB_URI` y una clave aleatoria larga en `JWT_SECRET`.
6. Ejecuta `npm start`.
7. Abre `http://localhost:3000`.

El archivo `.env` no debe subirse a GitHub.

## Endpoints principales
- `POST /api/auth/register` — crear usuario.
- `POST /api/auth/login` — iniciar sesión.
- `GET /api/usuarios` — listar usuarios (requiere token).
- `GET /api/tickets` y `POST /api/tickets` — consultar y crear tickets.
- `PATCH /api/tickets/:id` — cambiar estado de ticket.
- `GET /api/tareas` y `POST /api/tareas` — consultar y crear tareas.
- `PATCH /api/tareas/:id` — cambiar estado de tarea.
- `GET /api/mensajes` y `POST /api/mensajes` — chat global/privado.
- `GET /api/health` — comprobar estado del servicio.

Los endpoints de tickets y tareas requieren un token Bearer válido. Los registros se filtran por el usuario autenticado.

## Publicar en Render
1. Sube esta carpeta a un repositorio privado de GitHub. No subas `.env` ni contraseñas.
2. En Render, crea un servicio **Web Service** conectado al repositorio.
3. Build Command: `npm install`.
4. Start Command: `npm start`.
5. En **Environment**, agrega `MONGODB_URI` con la URI de tu propio MongoDB Atlas y `JWT_SECRET` con una cadena aleatoria segura de al menos 32 caracteres.
6. En MongoDB Atlas, verifica que la red de Render pueda conectarse y que el usuario de base de datos tenga permisos necesarios.
7. Despliega y prueba el enlace generado.

## Seguridad importante
La versión recibida tenía una URI de MongoDB con credenciales escrita directamente en `server.js`. Esta versión la elimina y lee las credenciales desde variables de entorno. Por precaución, cambia la contraseña del usuario de base de datos anterior en MongoDB Atlas y actualiza la URI en las variables de entorno.
