# Caso de referencia — Peugeot 206 2013 1.4 Active 75cv

Fecha de referencia: 2026-09-29

Objetivo: documentar cómo debe clasificar el sistema publicaciones de Mercado Libre para una cotización real.

## Regla

Una publicación solo puede entrar al cálculo automático si cumple:

- pieza correcta;
- nueva;
- original / OEM válida;
- presentación comparable;
- compatible con Peugeot 206 2013 1.4 Active 75cv.

Si el título limita la pieza a 1999-2012, se descarta para este vehículo aunque la pieza visualmente parezca igual.

## Paragolpe trasero

### POSIBLE — requiere confirmar compatibilidad exacta
- MLA2104052981 — "Paragolpes Trasero Peugeot 206"
  - Título no restringe año.
  - Falta confirmar marca de la pieza, estado real y compatibilidad con 2013.

### DESCARTAR
- MLA2097253504 — "Paragolpe Trasero P Peugeot 206 1999/2012 6C"
  - Año máximo declarado: 2012. Vehículo objetivo: 2013.

- MLA1449786379 — "Paragolpe Trasero P Peugeot 206 1999/2012 C"
  - Año máximo declarado: 2012. Vehículo objetivo: 2013.

### CANDIDATO FUERTE — si compatibilidad 2013 = TRUE
- MLA2055439563 — "Paragolpe Trasero Peugeot 206 Original Con Primer"
  - Declara original.
  - "Con primer" es aceptable como pieza nueva lista para pintar.
  - Verificar atributo de marca/OEM, imágenes y compatibilidad exacta.
  - El mismo link fue enviado dos veces: contar una sola publicación.

### DESCARTAR DEL PRECIO DE REPUESTO
- MLA3326622600 — "Paragolpe Tras 206 2003 Steja C/Primer Pintado y Colocado"
  - El título apunta a 2003.
  - Además incluye pintado/colocado: no es comparable con precio de pieza sola.
  - Puede servir como referencia separada de servicio/mano de obra si se valida.

## Portón trasero

El link de listado general no es una publicación y no entra como fuente de precio.

### REVISIÓN MANUAL
- MLA1722627313 — "Portón Trasero Peugeot 207 206"
  - Título demasiado amplio.
  - No demuestra originalidad ni año exacto.
  - Solo entra si marca/OEM + condición + selector confirman el vehículo.

### DESCARTAR
- MLA1440292127 — "Portón Trasero Peugeot 206 1999/2012 - Peugeot 207 2008/2016"
  - Para el 206 el rango termina en 2012.
  - El rango 2008/2016 corresponde al 207, no habilita un 206 2013.

### CANDIDATO FUERTE — si compatibilidad 2013 = TRUE
- MLA1434782550 — "Portón Trasero Peugeot 206 Original"
  - Declara original.
  - Requiere confirmar condición nueva, carrocería 3/5 puertas y compatibilidad exacta.

### POSIBLE — requiere validar cómo aplica el rango
- MLA2096349380 — "Portón Trasero Original Peugeot 206 207 1999/2016"
  - Declara original.
  - El rango del título es ambiguo al mezclar 206 y 207.
  - No asumir que 1999/2016 aplica al 206.
  - Solo entra si el selector confirma Peugeot 206 2013 1.4 Active 75cv.

## Aprendizajes para automatización

1. Un rango de años en el título tiene prioridad como señal de incompatibilidad cuando excluye el año buscado.
2. Los rangos combinados de varios modelos deben interpretarse por modelo, no globalmente.
3. "Original" en el título es una señal, no prueba suficiente: validar BRAND/OEM.
4. Pintado + colocado no se compara con pieza sola.
5. Duplicados por item ID se deduplican.
6. Una URL de listado/búsqueda no es una publicación válida para pricing.
7. Ante conflicto título vs selector, la compatibilidad confirmada por vehículo exacto debe quedar registrada como evidencia.
