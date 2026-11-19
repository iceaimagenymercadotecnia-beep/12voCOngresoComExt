# 12.º Congreso Internacional del ICEA — Plan de implementación

## Estado de esta entrega

**Parche de estabilización y especificación funcional. No es un sistema de registro productivo todavía.**

Se conservan el diseño, los archivos originales y el esquema de Supabase. Se agregó una pantalla de error cuando el arranque falla o excede 12 segundos; un aviso para configuración incompleta; se deshabilitó el registro de demostración que aparentaba crear cuentas; y se cerró por defecto el registro público hasta configurar y probar el servicio real.

**Importante:** la demostración sigue disponible para explorar perfiles de ejemplo, pero no persiste datos. El registro real depende de crear y configurar Supabase. No se han creado usuarios ni conectado un proyecto real. Los nuevos roles y el circuito de doble evaluación **están diseñados, pero no implementados** en esta versión. No ejecutar el archivo SQL de borrador.

## Decisiones aprobadas

1. Todas las personas se registran con correo y contraseña; por defecto reciben rol de autor.
2. Solo un administrador autorizado asigna o revoca permisos internos.
3. Cada trabajo recibe dos revisores distintos; cada uno evalúa de forma independiente.
4. El comité académico emite el dictamen final, revisa discrepancias y autoriza su publicación.
5. La coordinación general supervisa la operación, indicadores y comprobantes, sin sustituir al comité en decisiones académicas.
6. Administración técnica configura usuarios, permisos, respaldos y auditoría.

## Orden de trabajo propuesto

### Fase A — Activación del registro real
- Crear proyecto Supabase y aplicar `supabase/esquema.sql` en entorno de prueba.
- Configurar URL pública y clave **anon/publishable** en `assets/config.js` (nunca `service_role` ni secretos).
- Configurar URLs de redirección, SMTP, verificación de correo y protección antiabuso.
- Sustituir el aviso de privacidad de ejemplo por el aviso institucional aprobado.
- Crear cuentas de prueba y verificar alta, confirmación, sesión, recuperación y cierre.
- Probar RLS, cargas de archivos, acceso por roles y descargas temporales.
- Solo entonces cambiar `registroAbierto` a `true` y publicar.

### Fase B — Roles y evaluación independiente
- Migrar perfiles a `autor`, `revisor`, `comite`, `coordinacion`, `tecnico`; decidir si `lider` permanece como función de mesa.
- Crear asignaciones con máximo dos plazas y revisores distintos por trabajo.
- Crear rúbrica por criterios, comentarios privados y comentarios liberables al autor.
- Crear bandeja de pendientes para revisores y bandeja de dictámenes para comité.
- Hacer que solo el comité pueda modificar el dictamen final y publicar observaciones.
- Registrar trazabilidad, fechas, versiones y conflictos de interés.
- Aplicar RLS y reglas de Storage para cada rol; realizar pruebas negativas.

### Fase C — Coordinación y operación
- Tablero: usuarios, trabajos por mesa/estatus, evaluaciones pendientes, dictámenes, comprobantes y constancias.
- Configuración de fechas, convocatorias y plantillas de comunicaciones.
- Exportaciones CSV y respaldo; gestión de incidencias y bitácora de cambios.

## Matriz de permisos objetivo

| Acción | Autor | Revisor | Comité académico | Coordinación | Técnico |
|---|---|---|---|---|---|
| Registrar cuenta | Sí | Sí | Sí | Sí | Sí |
| Subir trabajo propio | Sí | Sí, como autor | Sí, como autor | Sí, como autor | Sí, como autor |
| Ver trabajos asignados | Propios | Asignados | Todos | Resumen operativo | Soporte mínimo |
| Evaluar | No | Solo propios | Supervisar | No | No |
| Ver ambas evaluaciones | No | No | Sí | No | No |
| Emitir dictamen | No | No | Sí | No | No |
| Validar pagos | No | No | Según delegación | Sí | No |
| Asignar roles | No | No | Según delegación | Según delegación | Sí |

## Pruebas de aceptación antes de lanzar

- Un usuario recién registrado siempre es autor y no puede elevar su rol.
- Un autor no puede abrir archivos de otro trabajo cambiando la URL.
- Dos revisores diferentes pueden evaluar un mismo trabajo; ninguno ve la evaluación ajena.
- El comité puede consultar ambas evaluaciones y publicar el dictamen final.
- La coordinación no puede alterar el dictamen.
- Los archivos son privados y no se exponen mediante enlaces permanentes.
- Se impide asignar el mismo revisor dos veces y se registran conflictos de interés.
- Registro y recuperación funcionan con correos reales.

## Colaboración con Claude

Compartir este ZIP y pedir a Claude: «Conserva el diseño y los archivos del portal. Implementa primero la Fase A y entrégame los cambios por archivo. No simules un registro real ni habilites roles sin RLS. Después implementa Fase B conforme a PLAN_IMPLEMENTACION_ICEA.md. No ejecutes el borrador SQL de la fase B. Incluye pruebas de seguridad y un registro de cambios. No coloques secretos en el repositorio».
