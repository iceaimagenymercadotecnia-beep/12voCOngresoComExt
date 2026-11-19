// Configuración del portal del 12 Congreso Internacional del ICEA.
// 1) Crea el proyecto en https://supabase.com
// 2) En Project Settings > API copia "Project URL" y "anon public key" aquí.
// Mientras estos dos valores estén vacíos, el portal funciona en MODO DEMOSTRACIÓN
// (datos de ejemplo, nada se guarda).
window.CONGRESO_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',

  // false = el botón "Crear cuenta" se oculta (por ejemplo, antes de publicar la convocatoria)
  registroAbierto: false, // Activar solo tras configurar Supabase, correo y aviso de privacidad

  // Texto que verán los autores junto al comprobante de pago
  indicacionesPago: 'Sube tu comprobante en PDF, JPG o PNG. El comité lo validará y verás el estatus aquí mismo.'
};
