(function () {
// Modo demostración: datos de ejemplo en memoria. Nada se guarda ni se envía.
const id = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));
const hace = (dias) => new Date(Date.now() - dias * 864e5).toISOString();
const copia = (o) => JSON.parse(JSON.stringify(o));

window.crearApiDemo = function crearApiDemo() {
  const mesas = [
    { id: 1, nombre: 'Mesa 1 · Turismo y transformación digital (ejemplo)', descripcion: '' },
    { id: 2, nombre: 'Mesa 2 · Administración y finanzas (ejemplo)', descripcion: '' },
    { id: 3, nombre: 'Mesa 3 · Mercadotecnia e innovación (ejemplo)', descripcion: '' }
  ];
  const perfiles = [
    { id: 'u-admin', correo: 'comite@ejemplo.mx', nombre: 'Comité', apellidos: 'Organizador', institucion: 'ICEA-UAEH', pais: 'México', telefono: '', rol: 'admin', mesa_id: null, created_at: hace(30) },
    { id: 'u-lider', correo: 'lider.mesa1@ejemplo.mx', nombre: 'Líder', apellidos: 'Mesa 1', institucion: 'ICEA-UAEH', pais: 'México', telefono: '', rol: 'lider', mesa_id: 1, created_at: hace(25) },
    { id: 'u-autor', correo: 'autora@ejemplo.mx', nombre: 'Autora', apellidos: 'De Ejemplo', institucion: 'Universidad de Ejemplo', pais: 'México', telefono: '', rol: 'autor', mesa_id: null, created_at: hace(10) },
    { id: 'u-autor2', correo: 'autor2@ejemplo.mx', nombre: 'Autor', apellidos: 'Invitado', institucion: 'Universidad Externa', pais: 'Colombia', telefono: '', rol: 'autor', mesa_id: null, created_at: hace(8) }
  ];
  let folio = 0;
  const nuevoFolio = () => 'ICEA12-' + String(++folio).padStart(4, '0');
  const archivos = {};
  const trabajos = [
    { autor_id: 'u-autor', titulo: 'Ecosistemas turísticos inteligentes y competitividad regional', mesa_id: 1, estatus: 'aceptado_con_cambios', observaciones: 'Precisar la metodología y actualizar referencias 2024-2026.', pago_estatus: 'validado', dias: 9 },
    { autor_id: 'u-autor', titulo: 'Adopción de herramientas digitales en mipymes de servicios', mesa_id: 2, estatus: 'recibido', pago_estatus: 'por_validar', dias: 3 },
    { autor_id: 'u-autor2', titulo: 'Experiencia del visitante en destinos patrimoniales', mesa_id: 1, estatus: 'recibido', pago_estatus: 'sin_comprobante', dias: 2 },
    { autor_id: 'u-autor2', titulo: 'Gobernanza digital en pueblos mágicos', mesa_id: 1, estatus: 'aceptado', pago_estatus: 'validado', dias: 7, carta: true }
  ].map((t) => {
    const tid = id();
    const r = {
      id: tid, folio: nuevoFolio(), autor_id: t.autor_id, titulo: t.titulo,
      resumen: 'Resumen de ejemplo del trabajo.', palabras_clave: 'ejemplo, demostración',
      coautores: '', mesa_id: t.mesa_id, estatus: t.estatus, observaciones: t.observaciones || null,
      manuscrito_path: `${tid}/manuscrito-1.pdf`, manuscrito_version: 1,
      comprobante_path: t.pago_estatus === 'sin_comprobante' ? null : `${tid}/comprobante-1.pdf`,
      pago_estatus: t.pago_estatus,
      carta_path: t.carta ? `${tid}/carta-1.pdf` : null, constancia_path: null,
      created_at: hace(t.dias), updated_at: hace(t.dias)
    };
    return r;
  });

  let actual = 'u-autor';
  const escuchas = [];
  const sesionDe = (uid) => (uid ? { user: { id: uid, email: perfiles.find((p) => p.id === uid).correo } } : null);
  const expandir = (t) => {
    const a = perfiles.find((p) => p.id === t.autor_id) || {};
    const m = mesas.find((x) => x.id === t.mesa_id);
    return copia({ ...t, autor: { nombre: a.nombre, apellidos: a.apellidos, correo: a.correo, institucion: a.institucion, pais: a.pais }, mesa: m ? { nombre: m.nombre } : null });
  };
  const visibles = () => {
    const yo = perfiles.find((p) => p.id === actual);
    return trabajos.filter((t) => yo.rol === 'admin' || t.autor_id === actual || (yo.rol === 'lider' && t.mesa_id === yo.mesa_id));
  };
  const esperar = () => new Promise((r) => setTimeout(r, 120));

  return {
    demo: true,
    cambiarUsuario(uid) { actual = uid; escuchas.forEach((cb) => cb('SIGNED_IN', sesionDe(uid))); },
    usuarioActual: () => actual,
    async sesion() { return sesionDe(actual); },
    alCambiarSesion(cb) { escuchas.push(cb); },
    async registrar() { await esperar(); return { user: null }; },
    async entrar() { await esperar(); actual = 'u-autor'; escuchas.forEach((cb) => cb('SIGNED_IN', sesionDe(actual))); },
    async salir() { actual = null; escuchas.forEach((cb) => cb('SIGNED_OUT', null)); },
    async recuperar() { await esperar(); },
    async nuevaClave() { await esperar(); },

    async miPerfil(uid) { return copia(perfiles.find((p) => p.id === uid)); },
    async guardarPerfil(pid, d) { const p = perfiles.find((x) => x.id === pid); Object.assign(p, d); return copia(p); },
    async perfiles() { return copia(perfiles); },

    async mesas() { return copia(mesas); },
    async crearMesa(d) { const m = { id: Math.max(0, ...mesas.map((x) => x.id)) + 1, descripcion: '', ...d }; mesas.push(m); return copia(m); },
    async guardarMesa(mid, d) { const m = mesas.find((x) => x.id === mid); Object.assign(m, d); return copia(m); },

    async trabajos() { await esperar(); return visibles().slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).map(expandir); },
    async crearTrabajo(d) {
      const t = { id: id(), folio: nuevoFolio(), autor_id: actual, estatus: 'recibido', observaciones: null, manuscrito_path: null, manuscrito_version: 0, comprobante_path: null, pago_estatus: 'sin_comprobante', carta_path: null, constancia_path: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...d };
      trabajos.push(t); return expandir(t);
    },
    async guardarTrabajo(tid, d) {
      const t = trabajos.find((x) => x.id === tid);
      const yo = perfiles.find((p) => p.id === actual);
      if (yo.rol !== 'admin' && d.comprobante_path && d.comprobante_path !== t.comprobante_path) d.pago_estatus = 'por_validar';
      if (t.estatus === 'aceptado_con_cambios' && d.manuscrito_path && t.autor_id === actual) d.estatus = 'en_revision';
      Object.assign(t, d, { updated_at: new Date().toISOString() });
      return expandir(t);
    },
    async subir(tid, tipo, file) { await esperar(); const ruta = `${tid}/${tipo}-${Date.now()}`; archivos[ruta] = URL.createObjectURL(file); return ruta; },
    async enlace(ruta) {
      if (archivos[ruta]) return archivos[ruta];
      const blob = new Blob(['Archivo de ejemplo del modo demostracion: ' + ruta], { type: 'text/plain' });
      return URL.createObjectURL(blob);
    }
  };
};
})();
