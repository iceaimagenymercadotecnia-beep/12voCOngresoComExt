(function () {
// Conexión real con Supabase (autenticación, base de datos y archivos privados)
const BUCKET = 'congreso';
const SEL = '*, autor:perfiles(nombre,apellidos,correo,institucion,pais), mesa:mesas(nombre)';

const urlBase = () => location.origin + location.pathname;
const ok = ({ data, error }) => { if (error) throw error; return data; };
const extension = (file) => {
  const m = /\.([a-z0-9]{2,5})$/i.exec(file.name || '');
  return m ? m[1].toLowerCase() : 'pdf';
};

window.crearApiSupabase = async function crearApiSupabase(cfg) {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  const sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

  return {
    demo: false,
    async sesion() { const { data } = await sb.auth.getSession(); return data.session; },
    alCambiarSesion(cb) { sb.auth.onAuthStateChange((evento, sesion) => cb(evento, sesion)); },
    async registrar({ correo, clave, datos }) {
      return ok(await sb.auth.signUp({ email: correo, password: clave, options: { data: datos, emailRedirectTo: urlBase() } }));
    },
    async entrar(correo, clave) { return ok(await sb.auth.signInWithPassword({ email: correo, password: clave })); },
    async salir() { await sb.auth.signOut(); },
    async recuperar(correo) { return ok(await sb.auth.resetPasswordForEmail(correo, { redirectTo: urlBase() })); },
    async nuevaClave(clave) { return ok(await sb.auth.updateUser({ password: clave })); },

    async miPerfil(uid) { return ok(await sb.from('perfiles').select('*').eq('id', uid).single()); },
    async guardarPerfil(id, d) { return ok(await sb.from('perfiles').update(d).eq('id', id).select().single()); },
    async perfiles() { return ok(await sb.from('perfiles').select('*').order('created_at')); },

    async mesas() { return ok(await sb.from('mesas').select('*').order('id')); },
    async crearMesa(d) { return ok(await sb.from('mesas').insert(d).select().single()); },
    async guardarMesa(id, d) { return ok(await sb.from('mesas').update(d).eq('id', id).select().single()); },

    async trabajos() { return ok(await sb.from('trabajos').select(SEL).order('created_at', { ascending: false })); },
    async crearTrabajo(d) { return ok(await sb.from('trabajos').insert(d).select(SEL).single()); },
    async guardarTrabajo(id, d) { return ok(await sb.from('trabajos').update(d).eq('id', id).select(SEL).single()); },

    async subir(trabajoId, tipo, file) {
      const ruta = `${trabajoId}/${tipo}-${Date.now()}.${extension(file)}`;
      ok(await sb.storage.from(BUCKET).upload(ruta, file, { contentType: file.type || undefined }));
      return ruta;
    },
    async enlace(ruta) {
      const d = ok(await sb.storage.from(BUCKET).createSignedUrl(ruta, 600));
      return d.signedUrl;
    }
  };
};
})();
