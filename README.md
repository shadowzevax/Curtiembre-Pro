# Curtiembre ERP

ERP de gestión para curtiembre (compras, producción, inventario, caja, contabilidad, ventas y RRHH).

Originalmente construido en Base44; ahora funciona con infraestructura propia:

- **Frontend:** React 18 + Vite + Tailwind (sin cambios visuales)
- **API:** funciones serverless en Vercel ([api/](api/))
- **Base de datos:** Postgres en Neon
- **Autenticación:** email y contraseña propia (JWT)

> ⚠️ **Importante:** el repositorio original `shadowzevax/curtiembre` está conectado al builder de Base44 —
> hacer push allí modifica la app de Base44 que sigue en producción. Esta versión migrada debe vivir
> en un repositorio o rama que Base44 NO tenga conectado.

## Configuración

1. Instalar dependencias: `npm install`
2. Copiar `.env.example` a `.env` y completar:
   - `DATABASE_URL` — cadena de conexión de Neon
   - `JWT_SECRET` — texto largo aleatorio
3. Crear tablas y el primer admin:
   ```
   npm run db:init -- tu@email.com tucontraseña "Tu Nombre"
   ```
4. Desarrollo local (levanta API en :3001 y web en :5173):
   ```
   npm run dev
   ```

## Migrar los datos desde Base44

1. En Base44: Dashboard de la app → Settings → API Keys → crear una key, ponerla en `.env` como `BASE44_API_KEY`
2. Exportar (solo lectura, no toca Base44): `npm run export:base44`
3. Importar a Neon: `npm run import:neon`
   - Los usuarios importados quedan con contraseña temporal `Cambiar123` (o define `IMPORT_USER_PASSWORD` en `.env`)

## Despliegue en Vercel

- Framework: Vite (detectado automático). Las funciones de [api/](api/) se despliegan solas.
- Variables de entorno requeridas en Vercel: `DATABASE_URL`, `JWT_SECRET`.

## Sistema de versiones (copias de seguridad)

Cada cambio publicado es una versión (v1, v2, ...). Se conservan las **últimas 5**.
La versión en ejecución se muestra en el menú lateral, debajo de "Salir".

Desde VS Code: menú **Terminal → Run Task** y elegir:

- **💾 Guardar nueva versión** — pide una descripción, publica y etiqueta la versión
- **📋 Ver versiones guardadas** — lista las últimas 5 con fecha y descripción
- **⏪ Restaurar versión** — eliges una y TODA la página vuelve a ese estado (se publica sola en ~1 min)

Equivalentes por terminal: `npm run version:guardar`, `npm run version:listar`, `npm run version:restaurar`.

Las restauraciones no borran historial: restaurar v2 crea una versión nueva con el contenido de v2.

## Estructura relevante

- [api/[...path].js](api/[...path].js) — punto de entrada de la API (auth, entidades, usuarios, archivos)
- [api/_lib/](api/_lib/) — lógica del backend (db, auth, CRUD de entidades, archivos)
- [src/api/entityFactory.js](src/api/entityFactory.js) — capa de compatibilidad con la interfaz del SDK de Base44
- [src/entities/](src/entities/) — módulos generados que reemplazan `@/entities/*` de Base44
- [migration/](migration/) — scripts de exportación/importación de datos
