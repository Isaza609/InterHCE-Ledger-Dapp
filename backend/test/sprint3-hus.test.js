const test = require("node:test");
const assert = require("node:assert/strict");

const {
  actorPuedeGestionarUsuarios,
  crearUsuarioIps,
  listarRolesSistema,
  obtenerCapacidadesRol,
  validarActorContraUsuarios,
  actualizarUsuarioIps
} = require("../dist/access/accesoUsuariosService");
const {
  otorgarPermisoEpisodio,
  revocarPermisoEpisodio,
  registrarPropietarioEpisodio,
  puedeAccederDocumento,
  listarPermisosEpisodio
} = require("../dist/hce/permisosEpisodioService");
const { validarAccesoOperacionClinica } = require("../dist/security/autorizacionService");

test("HU0-E3: roles del sistema y capacidades están definidos de forma explícita", () => {
  const roles = listarRolesSistema();
  assert.equal(roles.length >= 4, true);
  assert.equal(roles.some((item) => item.rol === "admin_ips"), true);
  assert.equal(obtenerCapacidadesRol("profesional_salud").includes("episodios.crear"), true);
});

test("HU1-E3 + HU5-E1: acciones no permitidas por rol se bloquean", () => {
  const accesoPaciente = validarAccesoOperacionClinica({
    rol: "paciente",
    ipsId: "IPS-001",
    usuarioId: "paciente-1"
  });
  assert.equal(accesoPaciente.ok, false);

  const accesoProfesional = validarAccesoOperacionClinica({
    rol: "profesional_salud",
    ipsId: "IPS-001",
    usuarioId: "profesional-001"
  });
  assert.deepEqual(accesoProfesional, { ok: true });
});

test("HU2-E3: administración de usuarios por IPS con activación/desactivación", () => {
  const admin = { rol: "admin_ips", ipsId: "IPS-001", usuarioId: "admin-ips-001" };
  assert.equal(actorPuedeGestionarUsuarios(admin), true);

  const create = crearUsuarioIps({
    usuarioId: `usuario-ips001-${Date.now()}`,
    nombre: "Auxiliar Clínica",
    rol: "profesional_salud",
    ipsId: "IPS-001"
  });
  assert.equal(create.ok, true);
  if (!create.ok) return;

  const checkActivo = validarActorContraUsuarios({
    rol: "profesional_salud",
    ipsId: "IPS-001",
    usuarioId: create.user.usuarioId
  });
  assert.deepEqual(checkActivo, { ok: true });

  const update = actualizarUsuarioIps(create.user.usuarioId, { activo: false });
  assert.equal(update.ok, true);
  if (!update.ok) return;

  const checkInactivo = validarActorContraUsuarios({
    rol: "profesional_salud",
    ipsId: "IPS-001",
    usuarioId: create.user.usuarioId
  });
  assert.equal(checkInactivo.ok, false);
});

test("HU4-E5: acceso a documentos off-chain depende de permisos válidos por IPS", () => {
  const episodeId = `ep-perm-${Date.now()}`;
  registrarPropietarioEpisodio(episodeId, "IPS-001");

  assert.equal(puedeAccederDocumento(episodeId, "IPS-001", "admin_ips"), true);
  assert.equal(puedeAccederDocumento(episodeId, "IPS-002", "profesional_salud"), false);

  const grant = otorgarPermisoEpisodio(episodeId, "IPS-001", "IPS-002");
  assert.equal(grant.ok, true);
  assert.equal(puedeAccederDocumento(episodeId, "IPS-002", "profesional_salud"), true);

  const perms = listarPermisosEpisodio(episodeId);
  assert.equal(perms.includes("IPS-002"), true);

  const revoke = revocarPermisoEpisodio(episodeId, "IPS-001", "IPS-002");
  assert.equal(revoke.ok, true);
  assert.equal(puedeAccederDocumento(episodeId, "IPS-002", "profesional_salud"), false);
});
