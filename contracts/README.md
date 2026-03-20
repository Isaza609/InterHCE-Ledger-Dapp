# Smart Contracts - InterHCE Ledger (Sprint 3)

Contratos para trazabilidad on-chain en testnet (Sepolia), sin almacenar datos clinicos sensibles.

## Requisitos

- Node.js >= 18
- Wallet de pruebas con fondos testnet
- RPC URL de Sepolia

## Configuracion

1. Copiar variables:

```bash
cp .env.example .env
```

2. Editar `.env`:
- `SEPOLIA_RPC_URL`
- `DEPLOYER_PRIVATE_KEY` (wallet de pruebas, nunca productiva)

3. Instalar dependencias:

```bash
npm install
```

## Compilar y desplegar

```bash
npm run compile
npm run deploy:sepolia
```

El despliegue genera `shared/blockchain/contracts.sepolia.json`, archivo consumible por frontend/backend.

## Contrato principal

- `contracts/InterHCELedger.sol`
  - Gestion de usuarios/roles (on-chain, metadatos).
  - Registro y actualizacion de episodios por hash.
  - Registro de permisos de documento por IPS.
  - Eventos de trazabilidad (`TrazaOperacion`).

## Verificacion en explorer

Con el hash de transaccion retornado por la DApp:
1. Abrir https://sepolia.etherscan.io/
2. Pegar tx hash.
3. Verificar eventos del contrato `InterHCELedger`.
