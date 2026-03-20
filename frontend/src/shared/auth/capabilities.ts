import type { RolSesion, SesionUsuario } from "./sessionStorage";

const CAPABILIDADES_POR_ROL: Record<RolSesion, string[]> = {
  profesional_salud: [
    "episodios.crear",
    "episodios.actualizar",
    "episodios.consultar",
    "episodios.documento.ver"
  ],
  admin_ips: [
    "episodios.crear",
    "episodios.actualizar",
    "episodios.consultar",
    "episodios.documento.ver",
    "ips.usuarios.gestionar",
    "ips.permisos.gestionar"
  ],
  paciente: ["episodios.consultar"],
  auditor: ["trazabilidad.consultar", "episodios.documento.ver"]
};

export function obtenerCapacidadesSesion(
  sesion: SesionUsuario | null
): string[] {
  if (!sesion) return [];
  return CAPABILIDADES_POR_ROL[sesion.rol] ?? [];
}

export function sesionTieneCapacidad(
  sesion: SesionUsuario | null,
  capacidad: string
): boolean {
  return obtenerCapacidadesSesion(sesion).includes(capacidad);
}
