# Arquitectura del frontend – InterHCE Ledger DApp

Este documento describe la estructura y arquitectura del frontend de la DApp InterHCE Ledger, alineada con el documento conceptual del proyecto y con el backend (validación HCE, API, integración FHIR y blockchain).

---

## 1. Objetivo del frontend

- **Interfaz de usuario** para los roles: paciente, profesional de la salud, administrador de IPS y auditor.
- **Conexión con wallet** (Ethereum) para identificación y firma de transacciones on-chain.
- **Consumo del backend** (API REST) para validación de episodios, orquestación y acceso a datos off-chain (HAPI FHIR).
- **Abstracción de la blockchain**: el usuario no debe manejar conceptos técnicos de red o gas; la DApp presenta flujos claros (crear episodio, otorgar permiso, consultar trazabilidad).

---

## 2. Stack tecnológico recomendado

| Capa | Tecnología | Uso |
|------|------------|-----|
| Framework UI | React 18+ (o Next.js si se requiere SSR/API routes) | Componentes, enrutado, estado |
| Lenguaje | TypeScript | Tipado alineado con `hceModel` y API |
| Estilos | CSS Modules / Tailwind CSS / styled-components | Estilos por componente o diseño system |
| Estado global | React Context + hooks o Zustand | Usuario, rol, IPS, episodios en sesión |
| Enrutado | React Router v6 | Rutas por rol y flujos (episodios, permisos, trazabilidad) |
| Blockchain | ethers.js v6 o wagmi + viem | Conexión wallet, lectura/escritura de contratos |
| HTTP / API | fetch o axios | Llamadas al backend (validación, FHIR proxy, etc.) |
| Formularios | React Hook Form + Zod | Formularios HCE alineados con `episodioFhirLikeSchema` |
| Build | Vite | Desarrollo rápido y build de producción |

---

## 3. Estructura de carpetas

```
frontend/
├── ARQUITECTURA.md          # Este documento
├── README.md                # Instalación y scripts
├── public/                  # Assets estáticos (favicon, etc.)
├── src/
│   ├── app/                 # Configuración de la aplicación
│   │   ├── router.tsx       # Definición de rutas y guards por rol
│   │   ├── providers.tsx    # Contextos (auth, wallet, tema)
│   │   └── App.tsx          # Raíz de la aplicación
│   │
│   ├── pages/               # Páginas (una por ruta principal)
│   │   ├── HomePage.tsx
│   │   ├── LoginPage.tsx
│   │   ├── EpisodiosPage.tsx
│   │   ├── EpisodioDetallePage.tsx
│   │   ├── PermisosPage.tsx
│   │   ├── TrazabilidadPage.tsx
│   │   └── ...
│   │
│   ├── features/            # Lógica y UI por dominio (por rol/caso de uso)
│   │   ├── auth/            # Autenticación y autorización por rol
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── context/
│   │   │   └── types.ts
│   │   ├── episodios/       # Crear, editar, listar, ver episodios clínicos
│   │   │   ├── components/  # Formularios HCE, listas, detalle
│   │   │   ├── hooks/       # useEpisodios, useCrearEpisodio, useValidarEpisodio
│   │   │   ├── services/    # Llamadas API + mapeo a modelo FHIR-like
│   │   │   └── types.ts
│   │   ├── permisos/        # Otorgar/revocar permisos entre IPS
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── services/
│   │   └── trazabilidad/    # Consulta de eventos on-chain (auditoría)
│   │       ├── components/
│   │       ├── hooks/
│   │       └── services/
│   │
│   ├── shared/              # Código reutilizable entre features
│   │   ├── components/      # Botones, inputs, cards, tablas, modales
│   │   ├── hooks/           # useWallet, useContract, useApi
│   │   ├── services/        # Cliente API, cliente FHIR, utilidades blockchain
│   │   ├── layout/          # Header, sidebar, layout por rol
│   │   ├── types/           # Tipos globales (EpisodioClinicoUrgencias, etc.)
│   │   └── utils/           # Formateo fechas, validación, constantes
│   │
│   └── assets/              # Imágenes, iconos, fuentes
│
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 4. Descripción de capas

### 4.1 `app/`

- **Router**: rutas públicas (login, landing) y rutas protegidas por rol (paciente, profesional, administrador IPS, auditor). Redirección a login si no hay sesión.
- **Providers**: proveedores de React para wallet (cuenta, red), usuario/rol/IPS (tras login o selección), y tema si aplica.

### 4.2 `pages/`

- Cada archivo corresponde a una **vista de nivel ruta** (una URL).
- Las páginas componen **componentes de `features/`** y de `shared/`; no deben contener lógica de negocio pesada, sino orquestación y maquetado.

### 4.3 `features/`

- **auth**: login (wallet + backend), selección de rol/IPS, guardado de sesión y permisos en UI.
- **episodios**: formularios de episodio clínico (alineados con `EpisodioClinicoUrgencias` y `episodioFhirLikeSchema`), listado, detalle, integridad (hash). Llama al backend para validar y, si aplica, a la blockchain para registrar.
- **permisos**: UI para otorgar/revocar permisos de acceso a otra IPS sobre un episodio; uso de Smart Contract y/o API según diseño.
- **trazabilidad**: listado y filtros de eventos on-chain (creación, actualización, permisos, accesos) para el rol auditor u otros autorizados.

Cada feature puede exponer:

- `components/`: componentes específicos del dominio.
- `hooks/`: lógica reutilizable (datos, mutaciones).
- `services/`: llamadas al backend y/o a la blockchain.
- `types.ts`: tipos locales del dominio.

### 4.4 `shared/`

- **components**: diseño system (botones, inputs, cards, tablas, alertas) y componentes de uso transversal (por ejemplo, selector de red, estado de wallet).
- **hooks**: por ejemplo `useWallet`, `useContract`, `useBackendApi`, para usar desde cualquier feature.
- **services**: cliente HTTP hacia el backend, cliente FHIR (si se llama desde el frontend), helpers para contratos (ethers/wagmi).
- **layout**: cabecera, menú por rol, contenedor principal.
- **types**: interfaces compartidas; se recomienda reutilizar o reexportar los tipos del backend (`EpisodioClinicoUrgencias`, etc.) para mantener coherencia.
- **utils**: formateo, validación ligera, constantes (URLs API, direcciones de contratos por red).

---

## 5. Flujo de datos

1. **Usuario conecta wallet** → el frontend obtiene cuenta y red; si el backend requiere identificación, se envía dirección o token derivado.
2. **Login / rol** → el usuario elige rol (o se infiere) y, si aplica, IPS; el backend puede devolver un token o sesión que se guarda en contexto.
3. **Crear/editar episodio** → el formulario construye un payload según `EpisodioClinicoUrgencias`; se envía al backend para **validación** (`validateEpisodioClinico`); si es válido, se puede enviar a HAPI FHIR (vía backend) y el hash + metadatos a la blockchain (desde el frontend con la wallet o vía backend según diseño).
4. **Permisos** → la UI de permisos dispara transacciones al Smart Contract (otorgar/revocar) y opcionalmente notifica al backend.
5. **Trazabilidad** → lectura on-chain (eventos) y, si aplica, datos resumidos desde el backend; la DApp solo muestra metadatos, sin datos clínicos sensibles.

---

## 6. Integración con backend y modelo HCE

- **Validación**: antes de registrar on-chain, el frontend envía el payload del episodio al backend; el backend usa `validateEpisodioClinico` y devuelve `{ valid, issues?, data? }`. La DApp muestra errores por campo si `valid === false`.
- **Tipos**: se recomienda compartir tipos con el backend (monorepo o paquete compartido) o copiar las interfaces de `backend/src/hce/hceModel.ts` en `shared/types/` para que formularios y servicios usen la misma estructura que el esquema Zod del backend.
- **API**: el backend expone endpoints (por ejemplo, `POST /episodios/validar`, `GET /episodios`, proxy a FHIR); el frontend usa un único cliente en `shared/services/` (por ejemplo, `api.ts` o `backendClient.ts`).

---

## 7. Seguridad y buenas prácticas

- No almacenar datos clínicos sensibles en el estado global más tiempo del necesario; no enviar a la blockchain información personal identificable.
- Mantener las claves privadas en la wallet; la DApp solo solicita firma de transacciones.
- Validar siempre en backend los payloads antes de cualquier registro; el frontend puede prevalidar con Zod usando el mismo esquema que el backend para mejor UX.
- Rutas y componentes sensibles protegidos por rol; el backend debe revalidar permisos en cada petición.

---

## 8. Referencias

- Documento conceptual: `docs_plan/1. Documento Conceptual de Funcionamiento.md`
- Modelo HCE y validación: `backend/src/hce/hceModel.ts`, `hceValidationSchema.ts`, `validationService.ts`
- Mapeo RDA–FHIR: `docs_plan/Mapeo_RDA_FHIR_urgencias.md`
- Requerimientos DApp: `docs_plan/2. Requerimientos funcionales y no funcionales.md` (RF9, RNF)
- Épica 5 y HUs DApp: `docs_plan/3. Epicas e HU.md`
