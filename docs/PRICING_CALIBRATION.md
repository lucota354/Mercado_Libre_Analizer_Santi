# Calibración de precio de cotización

## Por qué existe esta capa

El objetivo del sistema no es mostrar únicamente el precio observado en Mercado Libre.
El taller necesita saber **cuánto cotizarle al cliente**.

Por lo tanto hay que separar:

1. **Precio/costo de referencia de compra**: obtenido de publicaciones válidas.
2. **Precio de cotización al cliente**: costo de referencia + margen/colchón + redondeo comercial.

## Primer caso real de calibración

Vehículo de referencia:

```text
Peugeot 206 2013 1.4 Active 75cv
```

Valores informados por el cotizador humano:

```text
Portón trasero:     $900.000
Paragolpe trasero: $600.000
```

Referencias observadas en Mercado Libre durante el análisis:

```text
Portón original nuevo:      ~$600.000
Paragolpe original nuevo:   ~$380.780
```

### Hipótesis que reproduce el criterio

```text
precio cotizado = precio confiable de compra × 1,50
                  luego redondear hacia arriba
```

Portón:

```text
$600.000 × 1,50 = $900.000
=> cotización humana: $900.000
```

Paragolpe:

```text
$380.780 × 1,50 = $571.170
=> redondeo comercial: $600.000
=> cotización humana: $600.000
```

Este ejemplo encaja muy bien con **50% sobre el costo de referencia + redondeo**.

## Importante: no hardcodear como verdad definitiva

Un solo caso no alcanza para concluir que el taller siempre utiliza 50%.

Por ahora:

- guardar 50% como política inicial configurable;
- guardar cada cotización humana recibida;
- comparar precio de referencia vs precio finalmente cotizado;
- calcular el factor real por pieza/caso;
- cuando tengamos suficientes casos, decidir si el factor:
  - es fijo;
  - cambia por tipo de repuesto;
  - cambia por rango de precio;
  - incluye envío/riesgo/disponibilidad;
  - cambia según cantidad de publicaciones válidas.

## Elección del precio de compra

El sistema no debe usar automáticamente la mediana del mercado como si fuera el costo real.

Para cotizar reparaciones, el taller puede comprar la publicación **más económica que sea realmente confiable**, siempre que:

```text
compatible
AND original/OEM
AND nueva
AND misma pieza/presentación
AND disponible
AND vendedor/publicación confiable
```

Debe existir protección contra un precio anormalmente bajo.

Propuesta inicial:

1. Filtrar todos los inválidos.
2. Crear un cluster de precios válidos.
3. Detectar precios sospechosamente bajos/altos.
4. Dentro del cluster normal, elegir el **menor precio confiable** como costo de compra potencial.
5. Aplicar la política de cotización.
6. Mostrar también mediana y rango como contexto.

Así diferenciamos:

```text
Mercado válido: $380k - $520k
Costo comprable confiable: $380.780
Cotización cliente: $600.000
```

## Datos a registrar

Por cada cotización real:

- vehículo;
- pieza;
- publicaciones válidas;
- precio de compra elegido;
- mediana de mercado;
- rango;
- cotización sugerida por sistema;
- cotización elegida por el humano;
- factor humano / costo;
- diferencia sistema / humano;
- fecha.

Esto permitirá entrenar/calibrar las reglas con decisiones reales del taller.
