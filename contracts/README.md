# Smart Contracts - InterHCE Ledger

Contratos inteligentes (Solidity) para Ethereum testnet. Responsables de:

- Registro de episodios clínicos (identificador, paciente, IPS, fecha, hash del documento).
- Actualización de episodios (nuevos hashes, trazabilidad).
- Gestión de permisos entre IPS (otorgar/revocar).
- Control de acceso por roles (paciente, profesional, administrador IPS, auditor).
- Eventos de trazabilidad (creación, actualización, accesos, permisos).

**No se almacenan datos clínicos ni estructuras HCE en la Blockchain**; solo hashes y metadatos no sensibles.

Estructura típica con Hardhat:

- `contracts/` — fuentes Solidity.
- `test/` — tests de contratos.
- `scripts/` — despliegue y tareas.
