# Frontend – InterHCE Ledger DApp

Interfaz de usuario de la DApp InterHCE Ledger para la gestión de episodios clínicos de urgencias, permisos entre IPS y trazabilidad on-chain.

## Estructura y arquitectura

- **Estructura de carpetas y decisiones de arquitectura**: ver [ARQUITECTURA.md](./ARQUITECTURA.md).

## Estructura de carpetas (resumen)

```
frontend/
├── ARQUITECTURA.md    # Documento principal de arquitectura
├── README.md          # Este archivo
├── public/
├── src/
│   ├── app/           # Router, providers, App
│   ├── pages/         # Vistas por ruta
│   ├── features/      # auth, episodios, permisos, trazabilidad
│   ├── shared/        # components, hooks, services, layout, types, utils
│   └── assets/
└── (configuración: package.json, vite.config.ts, tsconfig.json)
```

## Cómo ejecutar

1. **Instalar dependencias**: `npm install`
2. **Modo desarrollo**: `npm run dev` (Vite en http://localhost:5173)
3. **Backend**: para validar y registrar episodios, tener el backend en marcha (por ejemplo `npm run dev` en la raíz del repo o en `backend/`) en el puerto 3001. La URL se puede cambiar con la variable de entorno `VITE_API_BASE_URL`.

## Sprint 3 - Portal integrado + testnet

1. Crear archivo de entorno:

```bash
cp .env.example .env
```

2. Configurar:
- `VITE_API_BASE_URL`
- `VITE_CHAIN_ID` (Sepolia: `11155111`)
- `VITE_TRACE_CONTRACT_ADDRESS` (direccion desplegada en testnet)
- `VITE_BLOCKCHAIN_EXPLORER_TX_BASE`

3. Ejecutar:

```bash
npm run dev
```

4. Flujo blockchain desde UI:
- Ir a `Portal Clinico`.
- Ingresar ID de episodio (opcional para traza).
- Pulsar `Registrar acceso documento` o `Registrar cambio permiso`.
- Confirmar transaccion en wallet.
- Copiar hash y abrir link de explorer mostrado en pantalla.

## Validación de HUs (Épica 0)

- **HU0-E0, HU1-E0, HU2-E0**: desde la DApp, en **Episodios → Crear episodio** se puede:
  - **Validar episodio**: envía el payload al backend `POST /episodes/validate` y muestra si cumple el modelo de HCE y los errores por campo.
  - **Registrar episodio**: envía el payload a `POST /episodes` (validación incluida) y muestra el resultado.

## Próximos pasos

1. Implementar `app/providers` con guards por rol y contexto de usuario/IPS.
2. Añadir más campos al formulario según `Caracterizacion HCE.csv` y mapeo FHIR.
3. Integrar wallet (ethers/wagmi) y contratos para registro on-chain.
4. Features: permisos entre IPS, trazabilidad/auditoría.
