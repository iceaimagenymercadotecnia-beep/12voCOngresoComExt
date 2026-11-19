(function () {
// Portal del 12 Congreso Internacional del ICEA

const cfg = window.CONGRESO_CONFIG || {};
const $ = (s, el = document) => el.querySelector(s);
const app = $('#app');
const MAX_MB = 15;

const ESTATUS = {
  recibido: 'Recibido', en_revision: 'En revisión', aceptado: 'Aceptado',
  aceptado_con_cambios: 'Aceptado con cambios', rechazado: 'No aceptado'
};
const PAGO = {
  sin_comprobante: 'Sin comprobante', por_validar: 'Pago por validar',
  validado: 'Pago validado', rechazado: 'Comprobante rechazado'
};
const ROL = { autor: 'Autor(a)', lider: 'Líder de mesa', admin: 'Comité organizador' }; // Roles nuevos en migración separada; no habilitar hasta integrar sus vistas.
const PENDIENTE = ['recibido', 'en_revision'];

const S = { api: null, sesion: null, perfil: null, mesas: [], trabajos: [], perfiles: [], vista: null, filtro: { mesa: '', estatus: 'pendientes', pago: '', q: '' } };

// ---------- utilidades ----------
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
const nombreAutor = (t) => esc([t.autor?.nombre, t.autor?.apellidos].filter(Boolean).join(' ') || t.autor?.correo || '—');
const badge = (clase, texto) => `<span class="badge b-${clase}">${esc(texto)}</span>`;
const bEst = (e) => badge(e, ESTATUS[e] || e);
const bPago = (p) => badge('p-' + p, PAGO[p] || p);

function traducir(err) {
  const m = String(err?.message || err || '');
  if (/Invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
  if (/Email not confirmed/i.test(m)) return 'Primero confirma tu correo con el enlace que te enviamos.';
  if (/already registered|already been registered/i.test(m)) return 'Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.';
  if (/Password should be at least/i.test(m)) return 'La contraseña debe tener al menos 8 caracteres.';
  if (/rate limit|too many/i.test(m)) return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
  if (/mime type|not supported/i.test(m)) return 'Tipo de archivo no permitido.';
  if (/exceeded the maximum allowed size|too large/i.test(m)) return `El archivo supera ${MAX_MB} MB.`;
  if (/Failed to fetch|NetworkError/i.test(m)) return 'No hay conexión con el servidor. Revisa tu internet.';
  return m || 'Ocurrió un error inesperado.';
}

function aviso(texto, tipo = 'ok') {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
  t.className = 'toast ' + tipo; t.textContent = texto; t.hidden = false;
  clearTimeout(aviso._t); aviso._t = setTimeout(() => (t.hidden = true), 4200);
}

async function ocupado(boton, fn) {
  const txt = boton?.textContent;
  if (boton) { boton.disabled = true; boton.textContent = 'Procesando…'; }
  try { return await fn(); }
  catch (e) { console.error(e); aviso(traducir(e), 'error'); }
  finally { if (boton && boton.isConnected) { boton.disabled = false; boton.textContent = txt; } }
}

function validarArchivo(file, tipos) {
  if (!file) throw new Error('Selecciona un archivo.');
  if (file.size > MAX_MB * 1048576) throw new Error(`El archivo supera ${MAX_MB} MB.`);
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!tipos.includes(ext)) throw new Error('Formato no permitido. Usa: ' + tipos.join(', ').toUpperCase());
}

const esAdmin = () => S.perfil?.rol === 'admin';
const esLider = () => S.perfil?.rol === 'lider';
const mesaNombre = (id) => S.mesas.find((m) => m.id === id)?.nombre || 'Sin asignar';

// ---------- arranque ----------
async function iniciar() {
  const real = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);
  if (!real && (cfg.supabaseUrl || cfg.supabaseAnonKey)) {
    app.innerHTML = '<div class="auth-wrap solo"><div class="card"><h2>Configuración incompleta</h2><p>Falta configurar la URL o la clave pública de Supabase. Revisa assets/config.js.</p></div></div>';
    return;
  }
  try {
    if (real) {
      S.api = await window.crearApiSupabase(cfg);
    } else {
      S.api = window.crearApiDemo();
    }
  } catch (e) {
    app.innerHTML = `<div class="auth-wrap solo"><div class="card"><h2>No se pudo conectar</h2><p class="muted">${esc(traducir(e))}</p></div></div>`;
    return;
  }
  if (S.api.demo) pintarBandaDemo();

  S.api.alCambiarSesion(async (evento, sesion) => {
    if (evento === 'PASSWORD_RECOVERY') { S.sesion = sesion; return pintarAuth('nueva-clave'); }
    if (evento === 'SIGNED_OUT') { S.sesion = null; S.perfil = null; return pintarAuth('entrar'); }
    if (!S.listo) return;
    if (evento === 'SIGNED_IN' && sesion && (!S.sesion || sesion.user.id !== S.sesion.user.id || S.api.demo)) {
      S.sesion = sesion; await cargarYMostrar(true);
    }
  });

  const recuperando = /type=recovery/.test(location.hash);
  S.sesion = await S.api.sesion();
  S.listo = true;
  if (recuperando) return pintarAuth('nueva-clave');
  if (S.sesion) return cargarYMostrar(true);
  pintarAuth(location.hash === '#registro' && cfg.registroAbierto !== false ? 'registro' : 'entrar');
}

async function cargarYMostrar(reiniciarVista) {
  app.innerHTML = '<div class="cargando">Cargando…</div>';
  try {
    S.perfil = await S.api.miPerfil(S.sesion.user.id);
    [S.mesas, S.trabajos] = await Promise.all([S.api.mesas(), S.api.trabajos()]);
    S.perfiles = esAdmin() ? await S.api.perfiles() : [];
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="auth-wrap solo"><div class="card"><h2>No se pudo cargar tu cuenta</h2><p class="muted">${esc(traducir(e))}</p><button class="btn" id="reintentar">Reintentar</button> <button class="btn sec" id="salir2">Cerrar sesión</button></div></div>`;
    $('#reintentar').onclick = () => cargarYMostrar(true);
    $('#salir2').onclick = () => S.api.salir();
    return;
  }
  if (reiniciarVista || !S.vista) S.vista = esAdmin() ? 'todos' : esLider() ? 'mesa' : 'mis';
  pintarApp();
}

async function recargar() {
  [S.mesas, S.trabajos] = await Promise.all([S.api.mesas(), S.api.trabajos()]);
  if (esAdmin()) S.perfiles = await S.api.perfiles();
  pintarApp();
}

// ---------- banda demo ----------
function pintarBandaDemo() {
  const b = document.createElement('div');
  b.className = 'demo-band';
  b.innerHTML = `<strong>Modo demostración</strong> · datos de ejemplo, nada se guarda. Ver como:
    <button data-u="u-autor">Autor(a)</button><button data-u="u-lider">Líder de mesa</button><button data-u="u-admin">Comité</button>`;
  b.addEventListener('click', (e) => { const u = e.target.dataset.u; if (u) S.api.cambiarUsuario(u); });
  document.body.prepend(b);
}

// ---------- autenticación ----------
function pintarAuth(modo) {
  const abierto = cfg.registroAbierto !== false && !S.api.demo;
  const tabs = `<div class="tabs" role="tablist">
      <button class="${modo === 'entrar' ? 'on' : ''}" data-modo="entrar">Iniciar sesión</button>
      ${abierto ? `<button class="${modo === 'registro' ? 'on' : ''}" data-modo="registro">Crear cuenta</button>` : ''}
    </div>`;
  let cuerpo = '';
  if (modo === 'entrar') cuerpo = `${tabs}
    <form id="f-entrar" class="form">
      <label>Correo electrónico<input name="correo" type="email" required autocomplete="email" placeholder="correo@institucion.edu.mx"></label>
      <label>Contraseña<input name="clave" type="password" required autocomplete="current-password"></label>
      <button class="btn full">Iniciar sesión</button>
      <a href="#" class="link" data-modo="recuperar">¿Olvidaste tu contraseña?</a>
    </form>`;
  if (modo === 'registro' && !abierto) modo = 'entrar';
  if (modo === 'registro') cuerpo = `${tabs}
    <form id="f-registro" class="form">
      <div class="grid2">
        <label>Nombre(s)<input name="nombre" required autocomplete="given-name"></label>
        <label>Apellidos<input name="apellidos" required autocomplete="family-name"></label>
      </div>
      <label>Institución de adscripción<input name="institucion" required autocomplete="organization"></label>
      <div class="grid2">
        <label>País<input name="pais" required value="México" autocomplete="country-name"></label>
        <label>Teléfono <span class="opt">(opcional)</span><input name="telefono" type="tel" autocomplete="tel"></label>
      </div>
      <label>Correo electrónico<input name="correo" type="email" required autocomplete="email"></label>
      <div class="grid2">
        <label>Contraseña<input name="clave" type="password" required minlength="8" autocomplete="new-password"></label>
        <label>Confirmar contraseña<input name="clave2" type="password" required minlength="8" autocomplete="new-password"></label>
      </div>
      <label class="check"><input type="checkbox" name="aviso" required><span>He leído y acepto el <a href="aviso-privacidad.html" target="_blank" rel="noopener">aviso de privacidad</a>.</span></label>
      <button class="btn full">Crear cuenta</button>
    </form>`;
  if (modo === 'recuperar') cuerpo = `<h2>Recuperar contraseña</h2>
    <p class="muted">Te enviaremos un enlace para crear una nueva contraseña.</p>
    <form id="f-recuperar" class="form">
      <label>Correo electrónico<input name="correo" type="email" required></label>
      <button class="btn full">Enviar enlace</button>
      <a href="#" class="link" data-modo="entrar">Volver a iniciar sesión</a>
    </form>`;
  if (modo === 'nueva-clave') cuerpo = `<h2>Nueva contraseña</h2>
    <form id="f-nueva" class="form">
      <label>Nueva contraseña<input name="clave" type="password" required minlength="8" autocomplete="new-password"></label>
      <label>Confirmar<input name="clave2" type="password" required minlength="8" autocomplete="new-password"></label>
      <button class="btn full">Guardar contraseña</button>
    </form>`;
  if (modo === 'confirmar') cuerpo = `<h2>Revisa tu correo</h2>
    <p class="muted">Te enviamos un enlace para confirmar tu cuenta. Al abrirlo, regresarás a este portal con tu sesión iniciada. Si no lo ves, revisa la carpeta de correo no deseado.</p>
    <button class="btn sec full" data-modo="entrar">Ir a iniciar sesión</button>`;

  app.innerHTML = `<div class="auth-wrap">
    <aside class="auth-side">
      <div class="kicker light">12 Congreso Internacional del ICEA</div>
      <h1>Portal de autores</h1>
      <p>Registra tu cuenta, envía tu manuscrito y tu comprobante de pago, y consulta el dictamen, tu carta de aceptación y tu constancia en un solo lugar.</p>
      <ol class="mini-steps"><li>Crea tu cuenta y confirma tu correo</li><li>Envía tu trabajo y comprobante</li><li>Da seguimiento con tu folio</li></ol>
    </aside>
    <div class="card auth-card">${cuerpo}</div></div>`;

  app.querySelectorAll('[data-modo]').forEach((el) => el.addEventListener('click', (e) => { e.preventDefault(); pintarAuth(el.dataset.modo); }));

  const f = app.querySelector('form');
  if (!f) return;
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    const boton = f.querySelector('button.btn');
    ocupado(boton, async () => {
      if (f.id === 'f-entrar') {
        await S.api.entrar(d.correo.trim(), d.clave);
      } else if (f.id === 'f-registro') {
        if (d.clave !== d.clave2) throw new Error('Las contraseñas no coinciden.');
        const datos = { nombre: d.nombre.trim(), apellidos: d.apellidos.trim(), institucion: d.institucion.trim(), pais: d.pais.trim(), telefono: d.telefono.trim() };
        const r = await S.api.registrar({ correo: d.correo.trim(), clave: d.clave, datos });
        if (r?.session) return; // confirmación de correo desactivada: entra directo
        pintarAuth('confirmar');
      } else if (f.id === 'f-recuperar') {
        await S.api.recuperar(d.correo.trim());
        aviso('Si el correo está registrado, recibirás el enlace en unos minutos.');
        pintarAuth('entrar');
      } else if (f.id === 'f-nueva') {
        if (d.clave !== d.clave2) throw new Error('Las contraseñas no coinciden.');
        await S.api.nuevaClave(d.clave);
        history.replaceState(null, '', location.pathname);
        aviso('Contraseña actualizada.');
        S.sesion = await S.api.sesion();
        if (S.sesion) cargarYMostrar(true); else pintarAuth('entrar');
      }
    });
  });
}

// ---------- aplicación ----------
function menu() {
  const items = [];
  if (esAdmin()) items.push(['todos', 'Todos los trabajos'], ['mesas', 'Mesas y líderes']);
  if (esLider()) items.push(['mesa', 'Mi mesa']);
  items.push(['mis', 'Mis trabajos'], ['nuevo', 'Nuevo envío'], ['datos', 'Mis datos']);
  return items.map(([v, t]) => `<button class="${S.vista === v ? 'on' : ''}" data-vista="${v}">${t}</button>`).join('');
}

function pintarApp() {
  const p = S.perfil;
  app.innerHTML = `
    <header class="p-header"><div class="p-top">
      <a href="index.html" class="p-brand"><img src="assets/logo-icea-blanco.png" alt="ICEA"></a>
      <div class="p-user"><div><strong>${esc(p.nombre)} ${esc(p.apellidos)}</strong><span>${ROL[p.rol]}${esLider() ? ' · ' + esc(mesaNombre(p.mesa_id)) : ''}</span></div>
      <button class="btn ghost" id="salir">Cerrar sesión</button></div></div>
      <nav class="p-nav">${menu()}</nav></header>
    <main class="p-main" id="vista"></main>`;
  $('#salir').onclick = () => S.api.salir();
  app.querySelectorAll('[data-vista]').forEach((b) => (b.onclick = () => { S.vista = b.dataset.vista; pintarApp(); }));
  const v = $('#vista');
  ({ mis: vistaMis, nuevo: vistaNuevo, datos: vistaDatos, mesa: vistaMesa, todos: vistaTodos, mesas: vistaMesas }[S.vista] || vistaMis)(v);
}

// ----- Autor: mis trabajos -----
function vistaMis(v) {
  const mios = S.trabajos.filter((t) => t.autor_id === S.perfil.id);
  v.innerHTML = `<div class="head"><div><div class="kicker">Mis trabajos</div><h2>Seguimiento de tus envíos</h2></div>
    <button class="btn" data-ir="nuevo">Nuevo envío</button></div>
    ${mios.length ? mios.map(tarjetaAutor).join('') : `<div class="card vacio"><h3>Aún no tienes trabajos enviados</h3><p class="muted">Envía tu manuscrito para obtener tu folio de registro.</p><button class="btn" data-ir="nuevo">Enviar mi trabajo</button></div>`}`;
  v.querySelectorAll('[data-ir]').forEach((b) => (b.onclick = () => { S.vista = b.dataset.ir; pintarApp(); }));
  enlazarArchivos(v);
  v.querySelectorAll('[data-subir]').forEach((inp) => inp.addEventListener('change', () => subirAutor(inp)));
}

function tarjetaAutor(t) {
  const puedeVersion = t.estatus === 'aceptado_con_cambios' || t.estatus === 'recibido';
  const puedePago = t.pago_estatus !== 'validado';
  return `<article class="card trabajo">
    <div class="t-head"><div><span class="folio">${esc(t.folio)}</span><h3>${esc(t.titulo)}</h3><p class="muted">${esc(t.mesa?.nombre || 'Mesa por asignar')} · Enviado el ${fecha(t.created_at)}</p></div>
    <div class="t-badges">${bEst(t.estatus)}${bPago(t.pago_estatus)}</div></div>
    ${t.observaciones ? `<div class="obs"><strong>Observaciones de la mesa</strong><p>${esc(t.observaciones)}</p></div>` : ''}
    <div class="docs">
      <div class="doc"><span>Manuscrito${t.manuscrito_version > 1 ? ' · versión ' + t.manuscrito_version : ''}</span>
        ${t.manuscrito_path ? `<button class="link" data-archivo="${esc(t.manuscrito_path)}">Ver archivo</button>` : '<em>Pendiente</em>'}
        ${puedeVersion ? `<label class="file-btn">${t.estatus === 'aceptado_con_cambios' ? 'Subir versión corregida' : 'Reemplazar'}<input type="file" hidden accept=".pdf,.doc,.docx" data-subir="manuscrito" data-id="${t.id}"></label>` : ''}</div>
      <div class="doc"><span>Comprobante de pago</span>
        ${t.comprobante_path ? `<button class="link" data-archivo="${esc(t.comprobante_path)}">Ver archivo</button>` : '<em>Pendiente</em>'}
        ${puedePago ? `<label class="file-btn">${t.comprobante_path ? 'Reemplazar' : 'Subir comprobante'}<input type="file" hidden accept=".pdf,.jpg,.jpeg,.png" data-subir="comprobante" data-id="${t.id}"></label>` : ''}</div>
      <div class="doc"><span>Carta de aceptación</span>${t.carta_path ? `<button class="link strong" data-archivo="${esc(t.carta_path)}">Descargar</button>` : '<em>Se publicará al emitirse el dictamen</em>'}</div>
      <div class="doc"><span>Constancia</span>${t.constancia_path ? `<button class="link strong" data-archivo="${esc(t.constancia_path)}">Descargar</button>` : '<em>Disponible después del congreso</em>'}</div>
    </div>
    ${puedePago && cfg.indicacionesPago ? `<p class="nota">${esc(cfg.indicacionesPago)}</p>` : ''}
  </article>`;
}

async function subirAutor(inp) {
  const file = inp.files[0]; const tipo = inp.dataset.subir; const t = S.trabajos.find((x) => x.id === inp.dataset.id);
  const etiqueta = inp.closest('label');
  await ocupado(null, async () => {
    validarArchivo(file, tipo === 'manuscrito' ? ['pdf', 'doc', 'docx'] : ['pdf', 'jpg', 'jpeg', 'png']);
    etiqueta.classList.add('cargando-btn');
    const ruta = await S.api.subir(t.id, tipo === 'manuscrito' ? `manuscrito-v${(t.manuscrito_version || 0) + 1}` : 'comprobante', file);
    const cambios = tipo === 'manuscrito' ? { manuscrito_path: ruta, manuscrito_version: (t.manuscrito_version || 0) + 1 } : { comprobante_path: ruta };
    await S.api.guardarTrabajo(t.id, cambios);
    aviso(tipo === 'manuscrito' ? 'Manuscrito actualizado.' : 'Comprobante enviado. Queda por validar.');
    await recargar();
  });
  etiqueta?.classList.remove('cargando-btn');
}

function enlazarArchivos(el) {
  el.querySelectorAll('[data-archivo]').forEach((b) => (b.onclick = () => abrirArchivo(b.dataset.archivo)));
}
async function abrirArchivo(ruta) {
  const w = window.open('', '_blank');
  try { const url = await S.api.enlace(ruta); if (w) w.location = url; else location.href = url; }
  catch (e) { w?.close(); aviso(traducir(e), 'error'); }
}

// ----- Autor: nuevo envío -----
function vistaNuevo(v) {
  v.innerHTML = `<div class="head"><div><div class="kicker">Nuevo envío</div><h2>Registra tu trabajo</h2></div></div>
  <form class="card form" id="f-trabajo">
    <label>Título del trabajo<input name="titulo" required maxlength="300"></label>
    <label>Mesa temática<select name="mesa_id" required><option value="">Selecciona una mesa</option>${S.mesas.map((m) => `<option value="${m.id}">${esc(m.nombre)}</option>`).join('')}</select></label>
    <label>Resumen<textarea name="resumen" rows="6" required maxlength="3000"></textarea></label>
    <label>Palabras clave <span class="opt">(separadas por comas)</span><input name="palabras_clave" required></label>
    <label>Coautores <span class="opt">(nombre completo e institución, uno por línea)</span><textarea name="coautores" rows="3"></textarea></label>
    <div class="grid2">
      <label>Manuscrito <span class="opt">(PDF o Word, máx. ${MAX_MB} MB)</span><input type="file" name="manuscrito" accept=".pdf,.doc,.docx" required></label>
      <label>Comprobante de pago <span class="opt">(PDF/JPG/PNG; puedes subirlo después)</span><input type="file" name="comprobante" accept=".pdf,.jpg,.jpeg,.png"></label>
    </div>
    <button class="btn">Enviar trabajo</button>
  </form>`;
  if (!S.mesas.length) $('#f-trabajo select').insertAdjacentHTML('afterend', '<p class="nota">El comité aún no ha dado de alta las mesas temáticas.</p>');
  const f = $('#f-trabajo');
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(f);
    const man = fd.get('manuscrito'); const comp = fd.get('comprobante');
    ocupado(f.querySelector('button.btn'), async () => {
      validarArchivo(man, ['pdf', 'doc', 'docx']);
      const tieneComp = comp && comp.size > 0;
      if (tieneComp) validarArchivo(comp, ['pdf', 'jpg', 'jpeg', 'png']);
      const t = await S.api.crearTrabajo({
        titulo: fd.get('titulo').trim(), mesa_id: Number(fd.get('mesa_id')) || null,
        resumen: fd.get('resumen').trim(), palabras_clave: fd.get('palabras_clave').trim(), coautores: fd.get('coautores').trim()
      });
      const cambios = { manuscrito_path: await S.api.subir(t.id, 'manuscrito-v1', man), manuscrito_version: 1 };
      if (tieneComp) cambios.comprobante_path = await S.api.subir(t.id, 'comprobante', comp);
      await S.api.guardarTrabajo(t.id, cambios);
      aviso(`Trabajo recibido. Tu folio es ${t.folio}.`);
      S.vista = 'mis'; await recargar();
    });
  });
}

// ----- Mis datos -----
function vistaDatos(v) {
  const p = S.perfil;
  v.innerHTML = `<div class="head"><div><div class="kicker">Mis datos</div><h2>Datos de contacto</h2><p class="muted">Así aparecerá tu nombre en cartas y constancias.</p></div></div>
  <form class="card form" id="f-datos">
    <div class="grid2"><label>Nombre(s)<input name="nombre" required value="${esc(p.nombre)}"></label><label>Apellidos<input name="apellidos" required value="${esc(p.apellidos)}"></label></div>
    <label>Institución<input name="institucion" required value="${esc(p.institucion)}"></label>
    <div class="grid2"><label>País<input name="pais" value="${esc(p.pais)}"></label><label>Teléfono<input name="telefono" value="${esc(p.telefono)}"></label></div>
    <label>Correo<input value="${esc(p.correo)}" disabled></label>
    <button class="btn">Guardar cambios</button>
  </form>`;
  const f = $('#f-datos');
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    Object.keys(d).forEach((k) => (d[k] = d[k].trim()));
    ocupado(f.querySelector('button'), async () => { S.perfil = await S.api.guardarPerfil(p.id, d); aviso('Datos actualizados.'); pintarApp(); });
  });
}

// ----- Líder y comité: listados -----
function filtrar(lista) {
  const f = S.filtro; const q = f.q.trim().toLowerCase();
  return lista.filter((t) =>
    (!f.mesa || String(t.mesa_id ?? 'sin') === f.mesa) &&
    (!f.estatus || (f.estatus === 'pendientes' ? PENDIENTE.includes(t.estatus) : t.estatus === f.estatus)) &&
    (!f.pago || t.pago_estatus === f.pago) &&
    (!q || [t.folio, t.titulo, t.autor?.nombre, t.autor?.apellidos, t.autor?.correo].join(' ').toLowerCase().includes(q)));
}

function kpis(lista) {
  const n = (fn) => lista.filter(fn).length;
  const items = [
    ['Trabajos', lista.length, ''],
    ['Por revisar', n((t) => PENDIENTE.includes(t.estatus)), 'pendientes'],
    ['Aceptados', n((t) => t.estatus === 'aceptado' || t.estatus === 'aceptado_con_cambios'), ''],
    ['Pagos por validar', n((t) => t.pago_estatus === 'por_validar'), 'pago']
  ];
  return `<div class="kpis">${items.map(([l, val, k]) => `<div class="kpi ${k}"><span>${l}</span><strong>${val}</strong></div>`).join('')}</div>`;
}

function barraFiltros(conMesa) {
  const f = S.filtro;
  const opt = (val, txt, sel) => `<option value="${val}" ${sel === val ? 'selected' : ''}>${esc(txt)}</option>`;
  return `<div class="filtros">
    <input type="search" id="fq" placeholder="Buscar por folio, título o autor" value="${esc(f.q)}">
    ${conMesa ? `<select id="fm">${opt('', 'Todas las mesas', f.mesa)}${opt('sin', 'Sin mesa asignada', f.mesa)}${S.mesas.map((m) => opt(String(m.id), m.nombre, f.mesa)).join('')}</select>` : ''}
    <select id="fe">${opt('pendientes', 'Pendientes de revisar', f.estatus)}${opt('', 'Todos los estatus', f.estatus)}${Object.entries(ESTATUS).map(([k, t]) => opt(k, t, f.estatus)).join('')}</select>
    <select id="fp">${opt('', 'Todos los pagos', f.pago)}${Object.entries(PAGO).map(([k, t]) => opt(k, t, f.pago)).join('')}</select>
  </div>`;
}

function tabla(lista, conMesa) {
  if (!lista.length) return '<div class="card vacio"><p class="muted">No hay trabajos con estos filtros.</p></div>';
  return `<div class="card tabla-wrap"><table class="tabla"><thead><tr><th>Folio</th><th>Título</th><th>Autor(a)</th>${conMesa ? '<th>Mesa</th>' : ''}<th>Recibido</th><th>Dictamen</th><th>Pago</th><th>Carta</th><th>Constancia</th></tr></thead><tbody>
  ${lista.map((t) => `<tr data-abrir="${t.id}" tabindex="0">
    <td class="folio">${esc(t.folio)}</td><td class="tit">${esc(t.titulo)}</td><td>${nombreAutor(t)}<small>${esc(t.autor?.institucion || '')}</small></td>
    ${conMesa ? `<td>${esc(t.mesa?.nombre || 'Sin asignar')}</td>` : ''}<td>${fecha(t.created_at)}</td>
    <td>${bEst(t.estatus)}</td><td>${bPago(t.pago_estatus)}</td>
    <td>${t.carta_path ? '<span class="si">✓</span>' : '<span class="no">—</span>'}</td><td>${t.constancia_path ? '<span class="si">✓</span>' : '<span class="no">—</span>'}</td></tr>`).join('')}
  </tbody></table></div>`;
}

function enlazarListado(v, repintar) {
  const set = (k, val) => { S.filtro[k] = val; repintar(); };
  $('#fq', v).addEventListener('input', (e) => { S.filtro.q = e.target.value; clearTimeout(enlazarListado._t); enlazarListado._t = setTimeout(() => { repintar(); const q = $('#fq'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 250); });
  $('#fm', v)?.addEventListener('change', (e) => set('mesa', e.target.value));
  $('#fe', v).addEventListener('change', (e) => set('estatus', e.target.value));
  $('#fp', v).addEventListener('change', (e) => set('pago', e.target.value));
  v.querySelectorAll('[data-abrir]').forEach((tr) => {
    tr.onclick = () => abrirDetalle(tr.dataset.abrir);
    tr.onkeydown = (e) => { if (e.key === 'Enter') abrirDetalle(tr.dataset.abrir); };
  });
}

function vistaMesa(v) {
  const deMesa = S.trabajos.filter((t) => t.mesa_id === S.perfil.mesa_id);
  const pintar = () => {
    v.innerHTML = `<div class="head"><div><div class="kicker">Mi mesa</div><h2>${esc(mesaNombre(S.perfil.mesa_id))}</h2><p class="muted">Abre cada trabajo para descargar el manuscrito, registrar el dictamen y subir la carta de aceptación o la constancia.</p></div></div>
      ${kpis(deMesa)}${barraFiltros(false)}${tabla(filtrar(deMesa), false)}`;
    enlazarListado(v, pintar);
  };
  if (!S.perfil.mesa_id) { v.innerHTML = '<div class="card vacio"><h3>Aún no tienes una mesa asignada</h3><p class="muted">El comité organizador debe asignarte una mesa.</p></div>'; return; }
  pintar();
}

function vistaTodos(v) {
  const pintar = () => {
    v.innerHTML = `<div class="head"><div><div class="kicker">Comité organizador</div><h2>Todos los trabajos</h2></div></div>
      ${kpis(S.trabajos)}${barraFiltros(true)}${tabla(filtrar(S.trabajos), true)}`;
    enlazarListado(v, pintar);
  };
  pintar();
}

// ----- Detalle de un trabajo (líder y comité) -----
function abrirDetalle(tid) {
  const t = S.trabajos.find((x) => x.id === tid);
  if (!t) return;
  const adm = esAdmin();
  const dlg = document.createElement('dialog');
  dlg.className = 'detalle';
  const opts = (obj, sel) => Object.entries(obj).map(([k, txt]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(txt)}</option>`).join('');
  const archivoFila = (titulo, ruta, tipo, acepta) => `<div class="doc"><span>${titulo}</span>
      ${ruta ? `<button class="link" data-archivo="${esc(ruta)}">Ver archivo</button>` : '<em>Sin archivo</em>'}
      ${tipo ? `<label class="file-btn">${ruta ? 'Reemplazar' : 'Subir'}<input type="file" hidden accept="${acepta}" data-tipo="${tipo}"></label>` : ''}</div>`;
  dlg.innerHTML = `<form method="dialog" class="d-cerrar"><button aria-label="Cerrar">×</button></form>
    <span class="folio">${esc(t.folio)}</span><h2>${esc(t.titulo)}</h2>
    <p class="muted">${nombreAutor(t)} · ${esc(t.autor?.institucion || '')} · ${esc(t.autor?.pais || '')} · <a href="mailto:${esc(t.autor?.correo)}">${esc(t.autor?.correo)}</a></p>
    <div class="d-grid">
      <section>
        <h4>Resumen</h4><p class="resumen">${esc(t.resumen) || '—'}</p>
        <h4>Palabras clave</h4><p>${esc(t.palabras_clave) || '—'}</p>
        <h4>Coautores</h4><p class="pre">${esc(t.coautores) || '—'}</p>
        <h4>Archivos</h4>
        <div class="docs col">
          ${archivoFila('Manuscrito' + (t.manuscrito_version > 1 ? ' · v' + t.manuscrito_version : ''), t.manuscrito_path)}
          ${archivoFila('Comprobante de pago', t.comprobante_path)}
          ${archivoFila('Carta de aceptación', t.carta_path, 'carta', '.pdf')}
          ${archivoFila('Constancia', t.constancia_path, 'constancia', '.pdf')}
        </div>
      </section>
      <section class="d-form">
        ${adm ? `<label>Mesa<select name="mesa_id"><option value="">Sin asignar</option>${S.mesas.map((m) => `<option value="${m.id}" ${m.id === t.mesa_id ? 'selected' : ''}>${esc(m.nombre)}</option>`).join('')}</select></label>` : ''}
        <label>Dictamen<select name="estatus">${opts(ESTATUS, t.estatus)}</select></label>
        <label>Observaciones para el autor<textarea name="observaciones" rows="6">${esc(t.observaciones)}</textarea></label>
        ${adm ? `<label>Pago<select name="pago_estatus">${opts(PAGO, t.pago_estatus)}</select></label>` : `<p class="nota">Pago: ${PAGO[t.pago_estatus]}</p>`}
        <button class="btn full" id="d-guardar">Guardar dictamen</button>
        <p class="nota">Recibido el ${fecha(t.created_at)} · última actualización ${fecha(t.updated_at)}</p>
      </section>
    </div>`;
  document.body.append(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  enlazarArchivos(dlg);

  $('#d-guardar', dlg).onclick = (e) => {
    e.preventDefault();
    const d = { estatus: $('[name=estatus]', dlg).value, observaciones: $('[name=observaciones]', dlg).value.trim() || null };
    if (adm) { d.mesa_id = Number($('[name=mesa_id]', dlg).value) || null; d.pago_estatus = $('[name=pago_estatus]', dlg).value; }
    ocupado(e.target, async () => { await S.api.guardarTrabajo(t.id, d); aviso('Cambios guardados.'); dlg.close(); await recargar(); });
  };
  dlg.querySelectorAll('[data-tipo]').forEach((inp) => inp.addEventListener('change', async () => {
    const tipo = inp.dataset.tipo; const lbl = inp.closest('label');
    await ocupado(null, async () => {
      validarArchivo(inp.files[0], ['pdf']);
      lbl.classList.add('cargando-btn');
      const ruta = await S.api.subir(t.id, tipo, inp.files[0]);
      await S.api.guardarTrabajo(t.id, { [tipo + '_path']: ruta });
      aviso(tipo === 'carta' ? 'Carta de aceptación publicada para el autor.' : 'Constancia publicada para el autor.');
      dlg.close(); await recargar(); abrirDetalle(t.id);
    });
    lbl?.classList.remove('cargando-btn');
  }));
  dlg.showModal();
}

// ----- Comité: mesas y líderes -----
function vistaMesas(v) {
  const lideres = (mid) => S.perfiles.filter((p) => p.rol === 'lider' && p.mesa_id === mid);
  const cuenta = (mid) => S.trabajos.filter((t) => t.mesa_id === mid).length;
  v.innerHTML = `<div class="head"><div><div class="kicker">Comité organizador</div><h2>Mesas y líderes</h2></div></div>
  <div class="d-grid">
    <section class="card">
      <h3>Mesas temáticas</h3>
      <ul class="lista-mesas">${S.mesas.map((m) => `<li><input value="${esc(m.nombre)}" data-mesa="${m.id}" aria-label="Nombre de la mesa"><small>${cuenta(m.id)} trabajos · líder: ${lideres(m.id).map((p) => esc(p.nombre + ' ' + p.apellidos)).join(', ') || 'sin asignar'}</small></li>`).join('') || '<li class="muted">Aún no hay mesas.</li>'}</ul>
      <form id="f-mesa" class="fila"><input name="nombre" placeholder="Nombre de la nueva mesa" required><button class="btn">Agregar</button></form>
    </section>
    <section class="card">
      <h3>Usuarios y roles</h3>
      <p class="muted">Para dar acceso a un líder de mesa, pídele que cree su cuenta en el portal y luego asígnale aquí el rol y la mesa.</p>
      <input type="search" id="fu" placeholder="Buscar usuario por nombre o correo">
      <div class="usuarios">${S.perfiles.map((p) => `<div class="usuario" data-busca="${esc((p.nombre + ' ' + p.apellidos + ' ' + p.correo).toLowerCase())}">
        <div><strong>${esc(p.nombre)} ${esc(p.apellidos)}</strong><small>${esc(p.correo)} · ${esc(p.institucion)}</small></div>
        <select data-rol="${p.id}" ${p.id === S.perfil.id ? 'disabled title="No puedes cambiar tu propio rol"' : ''}>${Object.entries(ROL).map(([k, t]) => `<option value="${k}" ${k === p.rol ? 'selected' : ''}>${t}</option>`).join('')}</select>
        <select data-mesa-de="${p.id}" ${p.rol !== 'lider' ? 'disabled' : ''}><option value="">Mesa…</option>${S.mesas.map((m) => `<option value="${m.id}" ${m.id === p.mesa_id ? 'selected' : ''}>${esc(m.nombre)}</option>`).join('')}</select>
      </div>`).join('')}</div>
    </section>
  </div>`;
  $('#f-mesa').addEventListener('submit', (e) => {
    e.preventDefault(); const n = e.target.nombre.value.trim();
    ocupado(e.target.querySelector('button'), async () => { await S.api.crearMesa({ nombre: n }); aviso('Mesa agregada.'); await recargar(); });
  });
  v.querySelectorAll('[data-mesa]').forEach((inp) => inp.addEventListener('change', () =>
    ocupado(null, async () => { await S.api.guardarMesa(Number(inp.dataset.mesa), { nombre: inp.value.trim() }); aviso('Nombre de mesa actualizado.'); await recargar(); })));
  v.querySelectorAll('[data-rol]').forEach((sel) => sel.addEventListener('change', () =>
    ocupado(null, async () => {
      const d = { rol: sel.value }; if (sel.value !== 'lider') d.mesa_id = null;
      await S.api.guardarPerfil(sel.dataset.rol, d); aviso('Rol actualizado.'); await recargar();
    })));
  v.querySelectorAll('[data-mesa-de]').forEach((sel) => sel.addEventListener('change', () =>
    ocupado(null, async () => { await S.api.guardarPerfil(sel.dataset.mesaDe, { mesa_id: Number(sel.value) || null }); aviso('Mesa asignada.'); await recargar(); })));
  $('#fu').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    v.querySelectorAll('.usuario').forEach((u) => (u.hidden = !u.dataset.busca.includes(q)));
  });
}

iniciar().catch((e) => {
  console.error('Error al iniciar el portal:', e);
  app.innerHTML = `<div class="auth-wrap solo"><div class="card"><h2>No fue posible iniciar el portal</h2><p class="muted">${esc(traducir(e))}</p><button class="btn" onclick="location.reload()">Volver a intentar</button></div></div>`;
});
})();
