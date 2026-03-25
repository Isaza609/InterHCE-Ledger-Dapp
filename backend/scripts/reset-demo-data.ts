/**
 * Deja en cero los archivos JSON locales del prototipo (episodios, permisos, trazas, RF10).
 *
 * IMPORTANTE — Blockchain:
 *   Las transacciones ya minadas en Sepolia (u otra red) NO se pueden “borrar”: el historial
 *   del ledger es inmutable. Al vaciar estos JSON el backend ya no tendrá los mismos episodeId
 *   ni correlación con esas transacciones; los hashes antiguos seguirán existiendo on-chain.
 *   Para un entorno de prueba suele valer: seguir usando la misma cuenta/contrato aceptando
 *   que el historial mezcla pruebas viejas y nuevas, o desplegar un contrato nuevo y apuntar
 *   el backend al nuevo address. Con BLOCKCHAIN_TRACE_MODE=mock no hubo txs reales.
 *
 * IMPORTANTE — HAPI FHIR:
 *   Este script NO toca PostgreSQL. Los recursos FHIR viven en el volumen Docker
 *   `hapi-fhir-postgres` (ver docker-compose.yml en la raíz del repo). Para borrarlos:
 *   en la raíz: `docker compose down -v` y luego `docker compose up -d`.
 *   El script imprime estos pasos al finalizar.
 *
 * Uso (desde el directorio backend/):
 *   RESET_DEMO_CONFIRM=YES npm run reset:demo-data
 *
 * Opciones:
 *   RESET_KEEP_AUDIT_METRICS=1 — no borra audit-metrics.json (métricas RF10).
 */

import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(__dirname, "../.env") });

import { saveJsonFile } from "../src/shared/jsonFileStore";

function main(): void {
  if (process.env.RESET_DEMO_CONFIRM?.trim() !== "YES") {
    console.error(
      "Para confirmar el borrado de datos locales, ejecute:\n" +
        "  RESET_DEMO_CONFIRM=YES npm run reset:demo-data\n" +
        "\n" +
        "Esto no revierte transacciones en blockchain (ver comentarios en scripts/reset-demo-data.ts)."
    );
    process.exit(1);
  }

  const cwd = process.cwd();
  if (!cwd.endsWith("backend") && !cwd.includes(`${path.sep}backend`)) {
    console.warn("Aviso: ejecute este script con cwd = backend/ (p. ej. cd backend && …)");
  }

  const files: string[] = [
    "episodio-trazabilidad.json",
    "episodio-permisos.json",
    "episodio-lifecycle.json"
  ];

  if (process.env.RESET_KEEP_AUDIT_METRICS?.trim() !== "1") {
    files.push("audit-metrics.json");
  }

  for (const f of files) {
    saveJsonFile(f, []);
    console.log("Vacío:", f);
  }

  if (process.env.RESET_KEEP_AUDIT_METRICS?.trim() === "1") {
    console.log("Conservado: audit-metrics.json (RESET_KEEP_AUDIT_METRICS=1)");
  }

  console.log(
    "\nListo (solo JSON en backend/data/). Reinicie el backend para vaciar la memoria in-process\n" +
      "(Map de episodios en RAM cuando no consultas FHIR)."
  );
  console.log(
    "\nBlockchain: las txs ya enviadas no se eliminan. Mock/trace en JSON solo borró referencias locales."
  );

  const repoRoot = path.resolve(__dirname, "../..");
  console.log(
    "\n--- HAPI FHIR (PostgreSQL): borrar datos clínicos de verdad ---\n" +
      "Los Patient / Encounter / DocumentReference, etc. siguen en la base del contenedor\n" +
      "`hapi-fhir-db` mientras exista el volumen `hapi-fhir-postgres`.\n\n" +
      "Desde la raíz del repo (donde está docker-compose.yml), típicamente:\n\n" +
      `  cd "${repoRoot}"\n` +
      "  docker compose down -v\n" +
      "  docker compose up -d\n\n" +
      "La bandera `-v` elimina el volumen: base FHIR en cero. Sin `-v`, al recrear el contenedor\n" +
      "los datos antiguos se conservan.\n\n" +
      "Orden sugerido para empezar de 0 (local + FHIR):\n" +
      "  1) Detener el backend Node.\n" +
      "  2) Este comando (reset JSON) — ya ejecutado.\n" +
      "  3) `docker compose down -v && docker compose up -d` en la raíz del repo.\n" +
      "  4) Arrancar el backend y, si quieres demo, `npm run seed:eval-demo` en backend/."
  );
}

main();
