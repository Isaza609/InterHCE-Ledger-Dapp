# DApp - InterHCE Ledger

Aplicación descentralizada (frontend) para interactuar con el sistema:

- Conexión con red Blockchain (wallet, testnet).
- Autenticación y autorización por rol (paciente, profesional, administrador IPS, auditor).
- Visualización de episodios clínicos según permisos.
- Creación y actualización de episodios (profesional/IPS).
- Gestión de permisos entre IPS (administrador).
- Consulta de trazabilidad (auditor).
- Integración con backend para documentos off-chain.

La DApp abstrae la complejidad de la Blockchain para profesionales y administradores.

Estructura sugerida: `src/` (components, pages, hooks, services), configuración (Vite/Next/React según stack elegido).
