# InterHCE Ledger

Prototipo de sistema para la **interoperabilidad de Historias Clínicas Electrónicas (HCE)** en urgencias, con almacenamiento off-chain en HL7 FHIR y trazabilidad mediante blockchain.

- **DApp (frontend)**: interfaz para registrar, consultar y buscar episodios clínicos.
- **Backend**: API REST con validación del modelo de HCE, persistencia en HAPI FHIR y cálculo de hashes para registro on-chain.
- **HAPI FHIR**: único almacenamiento off-chain; los datos clínicos se guardan como recursos FHIR (Patient, Encounter, Condition, etc.).

---

## Requisitos

- **Node.js** ≥ 18  
- **npm** ≥ 9  
- **Docker** y **Docker Compose** (para el servidor HAPI FHIR)

---

## Inicio rápido

### 1. Clonar el repositorio

```bash
git clone https://github.com/<tu-usuario>/<repositorio>.git
cd <repositorio>
```

### 2. Levantar HAPI FHIR (almacenamiento off-chain)

```bash
docker compose up -d hapi-fhir
```

- Interfaz web: http://localhost:8080/  
- API FHIR: http://localhost:8080/fhir/

La configuracion de `docker-compose.yml` ahora usa PostgreSQL con volumen persistente para que los recursos FHIR no se pierdan al reiniciar la maquina o recrear el contenedor.

Importante:

- No uses `docker compose down -v` si quieres conservar la base de datos de HAPI FHIR.
- `docker compose up -d hapi-fhir` levantara tambien la base `hapi-fhir-db` por dependencia.

### 3. Configurar el backend

```bash
cd backend
cp .env.example .env
```

Edita `.env` y deja al menos:

```env
FHIR_BASE_URL=http://localhost:8080/fhir
```

Si no defines `FHIR_BASE_URL`, el backend usará almacenamiento en memoria (los datos se pierden al reiniciar).

Ademas, el backend persiste en `backend/data/` el estado complementario del producto para que no se pierdan al reiniciar:

- lifecycle de episodios,
- permisos entre IPS,
- trazabilidad consultada por la app.

Ese directorio se genera automaticamente y no se versiona en git.

### 4. Instalar y ejecutar el backend

```bash
cd backend
npm install
npm run dev
```

El backend queda en **http://localhost:3001**. Documentación interactiva (Swagger): http://localhost:3001/docs

### 5. Instalar y ejecutar el frontend

En otra terminal:

```bash
cd frontend
npm install
npm run dev
```

La DApp queda en **http://localhost:5173**.

---

## Estructura del proyecto

```
├── backend/           # API Node.js + Express
│   ├── src/
│   │   ├── hce/       # Modelo HCE, validación, FHIR, documento clínico
│   │   ├── routes/    # Rutas /episodes
│   │   └── server.ts
│   └── .env.example
├── frontend/          # DApp React + Vite
│   └── src/
│       ├── pages/     # Episodios, Crear episodio, Ver episodio
│       ├── features/  # Formulario, validación
│       └── shared/    # API, tipos, utilidades
├── docs_plan/         # Arquitectura, épicas, mapeo RDA-FHIR
├── docs_dev/          # Guías de desarrollo (Sprint 1, HAPI FHIR)
├── docker-compose.yml # Servicio HAPI FHIR
└── README.md
```

---

## Funcionalidades principales

| Funcionalidad | Descripción |
|---------------|-------------|
| **Registrar episodio** | Formulario de episodio clínico (urgencias). Validación contra el modelo de HCE. Persistencia en HAPI FHIR. Devuelve `episodeId` y hash para uso on-chain. |
| **Listar todos los episodios** | Listado de todos los episodios registrados (desde HAPI FHIR o memoria). |
| **Buscar por cédula** | Búsqueda por identificador del paciente (mismo valor que “Identificador” al registrar). |
| **Ver documento** | Consulta del documento clínico de un episodio por su `episodeId`. |
| **Validar sin registrar** | Comprobar que el payload cumple el modelo antes de registrar. |

---

## API del backend (resumen)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/episodes/list` | Lista todos los episodios. |
| GET | `/episodes?patientIdentifier=XXX` | Busca episodios por documento del paciente. |
| GET | `/episodes/:id/document` | Obtiene el documento clínico de un episodio. |
| POST | `/episodes/validate` | Valida la estructura del episodio (no persiste). |
| POST | `/episodes` | Registra un episodio (valida, persiste en FHIR, devuelve `episodeId` y hash). |
| PUT | `/episodes/:id` | Actualiza un episodio existente. |

Documentación completa: http://localhost:3001/docs

---

## Variables de entorno

### Backend (`backend/.env`)

| Variable | Descripción |
|----------|-------------|
| `FHIR_BASE_URL` | URL base del servidor HAPI FHIR (ej. `http://localhost:8080/fhir`). Si no se define, se usa memoria. |
| `PORT` | Puerto del backend (por defecto 3001). |

### Frontend

La URL del backend se configura normalmente en build (por defecto apunta a `http://localhost:3001`). Ver `frontend/src/shared/utils/constants.ts` o `VITE_API_BASE_URL` si aplica.

---

## Documentación adicional

- **Arquitectura on-chain / off-chain**: `docs_plan/Arquitectura-on-chain-off-chain.md`  
- **Montaje de HAPI FHIR en Linux**: `docs_dev/Sprint 1/Montaje-servidor-HAPI-FHIR-Linux.md`  
- **Mapeo RDA → FHIR (urgencias)**: `docs_plan/Mapeo_RDA_FHIR_urgencias.md`  
- **Épicas e historias de usuario**: `docs_plan/3. Epicas e HU.md`  

---

## Licencia

MIT.
