# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**InterHCE Ledger** — Plataforma descentralizada para interoperabilidad de historias clínicas de emergencia (HCE) entre IPSs, con trazabilidad en blockchain. Stack: React/Vite DApp + Express/TypeScript API + HAPI FHIR + smart contracts en Solidity (testnet Sepolia).

## Development Commands

Run from each package directory:

```bash
# Frontend (http://localhost:5173)
cd frontend && npm run dev
cd frontend && npm run build      # type-check + bundle
cd frontend && npm run lint

# Backend (http://localhost:3001)
cd backend && npm run dev         # hot reload con ts-node-dev
cd backend && npm run build       # compila a backend/dist/
cd backend && npm run start       # ejecuta dist/

# HAPI FHIR + PostgreSQL
docker compose up -d              # desde la raíz

# Smart contracts (Sepolia)
cd contracts && npm run compile
cd contracts && npm run test
cd contracts && npm run deploy:sepolia
```

API docs disponibles en `http://localhost:3001/docs` (Swagger UI) cuando el backend está corriendo.

## Environment Variables

**Backend** (`backend/.env`):
```
FHIR_BASE_URL=http://localhost:8080/fhir
PORT=3001
```

**Frontend** (`frontend/.env`):
```
VITE_API_BASE_URL=http://localhost:3001
VITE_CHAIN_ID=11155111
VITE_TRACE_CONTRACT_ADDRESS=0x...
VITE_BLOCKCHAIN_EXPLORER_TX_BASE=https://sepolia.etherscan.io/tx/
```

## Architecture

### Data Flow
1. Usuario se autentica → token en localStorage → headers `Authorization`, `x-user-role`, `x-user-id`, `x-ips-id` en cada request.
2. Episodio clínico: frontend construye payload → POST `/episodes/validate` → si válido → POST `/episodes` → backend persiste recursos FHIR en HAPI FHIR + genera hash del documento → retorna `episodeId`, `documentHash`.
3. Trazabilidad: cada evento (creación, actualización, acceso, permiso) se registra en `backend/data/trazabilidad-eventos.json` y opcionalmente en el smart contract `InterHCELedger.sol` en Sepolia.
4. Permisos entre IPSs: servicio dedicado, almacenado en `backend/data/episodios-permisos.json`.

### Off-Chain Storage
- **HAPI FHIR** (puerto 8080): recursos clínicos estándar HL7 FHIR (Patient, Encounter, Condition, Observation, Procedure, etc.). El snapshot del episodio se guarda como `DocumentReference` en base64.
- **JSON File Store** (`backend/src/shared/jsonFileStore.ts`): archivos en `backend/data/` para lifecycle, permisos, trazabilidad, usuarios e IPSs. Persiste entre reinicios.

### Backend (`backend/src/`)
- **Entry point**: `server.ts` — Express con CORS, JSON body parser, rutas montadas en `/episodes`, `/auth`, `/access`, `/ips`, `/infra`, `/evaluation`.
- **HCE core**: `hce/hceModel.ts` define el schema FHIR-like del episodio; `hce/hceValidationSchema.ts` es el schema Zod; `hce/validationService.ts` lo ejecuta.
- **FHIR**: `hce/fhirClient.ts` hace CRUD al HAPI FHIR; `hce/fhirStorageService.ts` orquesta la persistencia de todos los recursos de un episodio.
- **Seguridad**: `security/autenticacionService.ts` maneja sesiones en memoria + hash SHA-256. Roles: `super_admin`, `admin_ips`, `profesional_salud`, `paciente`, `auditor`.

### Frontend (`frontend/src/`)
- **Routing**: `app/router.tsx` usa React Router v6 con guards `RequireSession` y `RequireCapability`.
- **Capacidades RBAC**: `shared/auth/capabilities.ts` define qué puede hacer cada rol (e.g., `episodios.crear`, `trazabilidad.consultar`). Las rutas y botones se protegen con `RequireCapability`.
- **API client**: `shared/services/api.ts` — wrapper de fetch que inyecta headers de sesión y maneja fallback localhost ↔ 127.0.0.1.
- **Tipos**: `shared/types/episodio.ts` — tipos TypeScript del episodio clínico para el frontend.
- **Catálogos RDA**: `shared/catalogos/rdaCatalogos.ts` — valores del estándar colombiano de urgencias (RDA-FHIR mapping).
- **Path alias**: `@/` apunta a `frontend/src/`.

### Smart Contract (`contracts/contracts/InterHCELedger.sol`)
Gestiona en Sepolia: roles de usuario, registro de episodios, permisos entre IPSs, y eventos de trazabilidad auditables. El backend puede operar en modo simulado (sin red) o real (Sepolia).

## Coding Conventions
- TypeScript strict en frontend y backend.
- 2 espacios, punto y coma, comillas dobles.
- `PascalCase` para componentes React, `camelCase` para funciones/variables.
- Nombres de dominio en español (`validarEpisodio`, `documentoClinicoService`, `accesoUsuariosService`).
- Exports nombrados para módulos compartidos.
- Commits en español imperativo: `Agrega validacion de episodios`.
- No commitear `dist/`, credenciales ni fixtures con datos de pacientes.

## Testing
No hay suite automatizada aún. Al agregar tests: frontend en `frontend/src/**/__tests__/*.test.tsx`, backend en `backend/src/**/__tests__/*.test.ts` o `backend/test/`. Priorizar rutas de episodios y comportamiento del schema HCE.
