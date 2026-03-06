# InterHCE Ledger

Plataforma descentralizada para la **interoperabilidad de Historias Clínicas Electrónicas (HCE)** en el escenario de **atención en urgencias**, permitiendo que la información acompañe al paciente entre Instituciones Prestadoras de Salud (IPS) de forma trazable y segura.

## Descripción

InterHCE Ledger es una DApp que utiliza **Blockchain (Ethereum testnet)** como capa de confianza y trazabilidad, sin almacenar datos clínicos sensibles on-chain. Los documentos clínicos se gestionan **off-chain**; en la cadena se registran únicamente metadatos no sensibles, identificadores y hashes criptográficos.

## Estructura del repositorio

| Carpeta | Contenido |
|---------|------------|
| **docs_plan/** | Contexto del proyecto: documento conceptual, requerimientos, épicas e historias de usuario |
| **docs/** | Documentación técnica: arquitectura, API, modelo HCE, guías |
| **contracts/** | Smart contracts (Solidity) para registro de episodios, permisos y trazabilidad |
| **dapp/** | Frontend de la DApp (interfaz para usuarios según rol) |
| **backend/** | Servicios off-chain: almacenamiento de documentos clínicos, validación HCE, API |
| **shared/** | Modelo HCE, esquemas y código compartido entre backend y DApp |
| **scripts/** | Scripts de despliegue, evaluación y simulación (múltiples IPS) |

## Cómo empezar

1. Revisar el contexto en **docs_plan/** (documento conceptual, requerimientos, épicas).
2. Consultar **docs/** para arquitectura, modelo de HCE y guías de desarrollo.
3. Configurar y desplegar contratos en **contracts/** (p. ej. con Hardhat).
4. Levantar el **backend** y la **dapp** según las guías en `docs/guias/`.

## Tecnologías

- **Blockchain**: Ethereum (testnet; diseño portable a red permisionada).
- **Contratos**: Solidity.
- **Off-chain**: Backend (API + almacenamiento), modelo de HCE alineado con RDA y normativa colombiana.

## Documentación de referencia

- [Documento conceptual](docs_plan/1.%20Documento%20Conceptual%20de%20Funcionamiento.md)
- [Requerimientos funcionales y no funcionales](docs_plan/2.%20Requerimientos%20funcionales%20y%20no%20funcionales.md)
- [Épicas e historias de usuario](docs_plan/3.%20Epicas%20e%20HU.md)
