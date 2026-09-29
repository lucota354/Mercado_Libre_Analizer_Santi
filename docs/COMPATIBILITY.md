# Verificación de compatibilidad

## Objetivo

Antes de aceptar el precio de una publicación, confirmar que la pieza sea compatible con el vehículo exacto del caso.

Ejemplo visual esperado en Mercado Libre:

```text
Marca: Peugeot
Modelo: 206
Año: 2013
Versión: 1.4 Active 75cv
```

Si la publicación muestra **No es compatible con tu vehículo**, el candidato queda descartado.

## Catálogo de vehículo para Argentina

Dominio principal:

```text
MLA-CARS_AND_VANS
```

Atributos principales usados por el proyecto:

```text
BRAND
MODEL
VEHICLE_YEAR
SHORT_VERSION
ENGINE
```

Se construirá el selector progresivamente usando `top_values`:

```text
Marca
  -> Modelo
     -> Año
        -> Versión
           -> Motor
```

Esto evita que el operador escriba versiones libres cuando Mercado Libre ya tiene una taxonomía conocida.

## Pipeline de verificación por publicación

```text
Publicación candidata
        |
        v
GET compatibilities
        |
        +-- detalle suficiente? --> comparar vehículo + notas + posición
        |
        +-- detalle insuficiente / catálogo resumido
                          |
                          v
             selector de compatibilidad
             de la publicación
                          |
                          v
             compatible / incompatible / unknown
```

## Regla de seguridad

`unknown` nunca se trata como compatible.

Un precio solo entra al cálculo automático si:

```text
ORIGINAL
AND NUEVO
AND PIEZA CORRECTA
AND PRESENTACIÓN EQUIVALENTE
AND COMPATIBLE = TRUE
```

## Modelos compatibles

Cuando la API entregue compatibilidades detalladas se guardará la lista de vehículos/modelos compatibles para mostrarla en la interfaz.

Cuando Mercado Libre solo entregue un resumen de catálogo, el sistema no inventará la lista completa. En ese caso se verificará el vehículo concreto que estamos cotizando mediante el selector de la publicación y se almacenará el resultado de esa comprobación.

## Posición

Si una compatibilidad tiene restricciones de posición, también debe coincidir.

Ejemplos:

- Delantero vs trasero.
- Derecho vs izquierdo.
- Superior vs inferior.

Una pieza compatible con el modelo pero para otra posición se descarta.
