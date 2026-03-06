# Backend - InterHCE Ledger

Servicios off-chain:

- **Almacenamiento** de documentos clínicos (HCE) fuera de la Blockchain.
- **Validación** de episodios contra el modelo de HCE (Épica 0).
- **API** para la DApp: subida/consulta de documentos, cálculo/verificación de hashes.
- **Control de acceso** coherente con permisos registrados on-chain.

Los datos clínicos completos residen aquí; en Blockchain solo se almacenan hashes y metadatos no sensibles.

## Estructura actual

- `src/server.ts`: arranque del servidor Express y endpoint `GET /health`.
- `src/routes/episodes.ts`: rutas para creación, actualización y validación estructural de episodios (`POST /episodes`, `PUT /episodes/:id`, `POST /episodes/validate`).
- `src/hce/hceModel.ts`: interfaces TypeScript que representan la estructura mínima del **episodio clínico de urgencias** (subconjunto de la caracterización HCE).
- `src/hce/hceValidationSchema.ts`: esquema de validación (`zod`) alineado con HU0-E0 y HU1-E0 para ese subconjunto.
- `src/hce/validationService.ts`: servicio que expone `validateEpisodioClinico`, utilizado por las rutas de `episodes`.

## Requisitos previos

- Node.js >= 18
- npm >= 9

## Instalación y ejecución

1. Instalar dependencias (desde la carpeta `backend`):

   ```bash
   npm install
   ```

2. Ejecutar en modo desarrollo:

   ```bash
   npm run dev
   ```

   El backend se levantará por defecto en `http://localhost:3001` (configurable con la variable de entorno `PORT`).

3. Compilar y ejecutar en modo producción:

   ```bash
   npm run build
   npm start
   ```

## Exploración de la API (Swagger / OpenAPI)

- Documentación interactiva (Swagger UI):  
  - `http://localhost:3001/docs`

  Desde esta URL puedes:
  - Ver todos los endpoints disponibles.  
  - Consultar esquemas de entrada/salida.  
  - Ejecutar llamadas de prueba directamente desde el navegador.

- Resumen JSON del OpenAPI:  
  - Actualmente embebido en `src/docs/openapi.ts` y servido a través de Swagger UI.

## Endpoints relevantes para la Épica 0 (HU0-E0, HU1-E0, HU2-E0)

- `GET /health`  
  - Verifica que el servicio esté levantado.

- `POST /episodes/validate`  
  - Entrada: JSON que representa un episodio clínico de urgencias (estructura definida en `hceModel.ts`).  
  - Comportamiento: valida el payload contra el esquema del modelo de HCE.  
  - Respuestas:
    - `200 OK`: episodio **válido estructuralmente**.  
    - `400 Bad Request`: `code = "VALIDATION_ERROR"` con `details` por campo (`field`, `issue`).

- `POST /episodes`  
  - Valida el episodio.  
  - Si falla, responde como `VALIDATION_ERROR`.  
  - Si pasa la validación, responde `EPISODE_REGISTERED` indicando que el episodio está listo para:
    - Persistencia off-chain (por implementar).  
    - Cálculo de hash y registro on-chain (por integrar con los contratos).

- `PUT /episodes/:id`  
  - Misma lógica de validación que `POST /episodes`, para actualizaciones.

Estos endpoints implementan el diseño descrito en `docs_dev/Sprint 1/HU2-E0-Validacion.md` para la validación estructural de episodios clínicos.

