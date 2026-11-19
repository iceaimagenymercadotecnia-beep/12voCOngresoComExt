# 12.º Congreso ICEA — Prototipo para Dirección y puesta en marcha

## Presentación a Dirección
Abrir `prototipo-directora.html` (o desde el enlace «Ver prototipo» en `index.html`). Es una demostración navegable **sin base de datos**, con cifras y folios ficticios; ninguna acción registra datos reales ni genera constancias válidas.

## Modelo funcional acordado
- Una identidad por persona, con múltiples roles simultáneos: autor, revisor, líder de mesa, comité, coordinación académica, coordinación general y administración técnica.
- Siete mesas: Administración, Comercio Exterior, Contaduría, Economía, Mercadotecnia, Gastronomía y Turismo.
- Los líderes proponen revisores; coordinación académica (Sonia Gayosso Mexia) autoriza el padrón, idealmente por lotes.
- Los líderes asignan dos revisores autorizados de su mesa por trabajo, sin conflictos de interés. Las evaluaciones son independientes y doble ciego.
- Si uno rechaza y el otro acepta (con o sin modificaciones), se marca discrepancia y el líder asigna tercer revisor autorizado. El comité emite el dictamen definitivo razonado; nunca se decide automáticamente por mayoría.
- El líder gestiona seguimiento y sustituciones; coordinación académica solo recibe excepciones.
- Cartas de aceptación y constancias por función en expediente único. Emisión condicionada a autorizaciones institucionales, firma/plantilla, validación y registro de auditoría.

## Requisitos oficiales de convocatoria
- Congreso: 23–25 junio 2027; apertura de registro 6 enero 2027; cierre de resúmenes 28 febrero 2027; cartas 29 marzo–2 abril 2027.
- Ponencia y cartel: resumen ampliado 1,500–2,000 palabras, hasta tres autores; primer autor estudiante en cartel.
- Los datos de autoría se registran por separado para arbitraje doble ciego. Manuscritos extensos y videos son procesos opcionales posteriores y distintos.
- La convocatoria establece pago por ponencia aceptada, no por autor; comprobante del primer autor.

## Ruta técnica antes de abrir el registro
1. Aprobar prototipo, reglas, responsables y criterios de constancias con Dirección y comité.
2. Crear proyecto Supabase institucional; configurar autenticación, verificación de correo, dominio, límites y recuperación de acceso. **Nunca incluir claves secretas en archivos públicos**.
3. Modelar usuarios, perfiles, roles múltiples, mesas, líderes, revisores aprobados, trabajos, coautores, versiones, asignaciones, rúbricas, dictámenes, pagos, documentos y bitácora.
4. Aplicar políticas RLS a todas las tablas y almacenamiento privado; probar autorización en servidor, no solo ocultar botones. Separar autoría y archivos anonimizados; evitar identificación en metadatos y nombres.
5. Implementar el circuito de registro y recepción con validaciones de convocatoria, límites de archivos y folios únicos transaccionales.
6. Implementar doble arbitraje, tercer arbitraje por discrepancia, decisiones justificadas del comité y alertas automáticas.
7. Implementar plantillas PDF y códigos de verificación con identificadores no adivinables; autorización formal para firmas y emisión; no publicar firmas como recursos reutilizables.
8. Integrar correo transaccional, comprobación de entrega, reintentos, respaldos, monitoreo, protección anti-spam y procedimientos de recuperación.
9. Probar con cuentas de cada rol y combinaciones de roles, carga simultánea, duplicados, cambios de mesa, coautorías, vencimientos, fallos de red, dispositivos móviles, permisos y restauración de respaldos.
10. Hacer piloto cerrado, corregir incidencias, congelar cambios y publicar solo después de aprobación de pruebas y privacidad.

## Criterios de salida obligatorios
- Crear cuenta, confirmar correo, iniciar sesión, recuperar contraseña y cerrar sesión funcionan de principio a fin.
- Nadie ve trabajos, datos de autoría, evaluaciones, pagos o constancias ajenos sin permiso.
- Una persona puede ser autora y revisora, pero jamás revisar sus propios trabajos o los de sus coautores.
- Dos revisiones independientes; tercera si corresponde; el comité conserva la decisión final.
- Los archivos persisten, se recuperan y están protegidos; cartas y constancias solo aparecen tras autorización.
- Alertas, auditoría, backups y pruebas de restauración funcionan.

**Advertencia:** El ZIP actual contiene un prototipo de presentación y código base pendiente de integración. No activar `registroAbierto` ni publicar como sistema de recepción hasta completar las pruebas anteriores.
