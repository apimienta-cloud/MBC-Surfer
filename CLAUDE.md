# Escapale al Lunes — Spec del juego

> Endless runner 3D de 3 carriles (mecánica estilo Subway Surfers, pero con todo el contenido original).
> Una birra corre por lugares icónicos de Montevideo juntando fichitas de MBC mientras la persigue el Lunes: una hoja de calendario gigante, enojada, que dice "LUNES".

Este archivo es la fuente de verdad del proyecto. Si algo no está definido acá, tomá la decisión más simple que respete el concepto y dejala anotada en `DECISIONES.md`.

---

## 1. Concepto y tono

- **Protagonista:** una birra (porrón ámbar con espuma, tapita, ojos cartoon, bracitos y patitas).
- **Perseguidor:** el Lunes — un bloque de calendario de pared con anillas arriba, la hoja dice **LUNES** en rojo con el número del día, cejas enojadas, boca gritona, bracitos y piernas.
- **Objetivo:** correr lo más lejos posible por Montevideo, juntar **fichitas MBC** y que no te agarre el lunes.
- **Tono:** humor rioplatense, cálido, nada agresivo. Todos los textos en español de Uruguay con voseo ("Jugá", "Te agarró el lunes", "¿Revancha?").

---

## 2. Stack técnico

- **Vite + TypeScript + Three.js** (sin React ni frameworks de UI; el HUD y los menús van en HTML/CSS superpuesto al canvas).
- **Sin modelos 3D externos obligatorios:** todo se construye low-poly con primitivas de Three.js (Box, Cylinder, Cone, Sphere, Capsule, Extrude). Cada modelo vive en su propio builder para poder reemplazarlo después por un `.glb` sin tocar la lógica.
- **Audio:** Web Audio API (o Howler.js). Si no hay sonidos, generar efectos simples por síntesis y dejar los archivos como placeholders.
- **Target:** mobile first (Safari iOS y Chrome Android), apuntando a 60 fps en un celular de gama media. También tiene que jugarse bien en desktop.
- **Build:** sitio estático (`npm run build` → `dist/`) deployable en Netlify o GitHub Pages.

---

## 3. Controles

| Acción | Mobile | Desktop |
|---|---|---|
| Carril izquierda / derecha | Swipe ← / → | ← / → o A / D |
| Saltar | Swipe ↑ | ↑, W o Espacio |
| Rodar (agacharse) | Swipe ↓ | ↓ o S |
| Usar "Feriado" (si hay guardado) | Doble tap | E |
| Pausa | Botón en HUD | Esc / P |

- Buffer de input de ~150 ms (si apretás saltar justo antes de aterrizar, salta igual).
- Cambio de carril con tween de ~120 ms.
- Swipe down en el aire = cae rápido y rueda al tocar el piso.

---

## 4. Personaje: la Birra

Construcción low-poly:
- Cuerpo: cilindro ámbar (`#C8862B`), material con poca rugosidad para que brille; cuello más angosto; tapita dorada con bordecito dentado.
- Etiqueta: un plano curvo alrededor del cuerpo. Si existe `public/assets/brand/mbc-logo.png`, se usa como textura; si no, etiqueta de color liso (no inventar logos).
- Espuma: esferitas blancas arriba que se mueven con el movimiento; al saltar salen partículas de espuma.
- Cara: ojos grandes cartoon, cejas expresivas, boca.
- Brazos y piernas: cápsulas finitas.

Animaciones procedurales (sin rig, por código):
- **Correr:** balanceo de piernas y brazos, rebote del cuerpo, leve inclinación hacia adelante.
- **Saltar:** squash & stretch (se achata al despegar, se estira en el aire, se achata al caer).
- **Rodar:** la birra se acuesta y **rueda como botella** por el piso (este es el chiste visual clave).
- **Tropezar:** tambaleo + chorrito de espuma.
- **Atrapada:** cara de pánico, el Lunes la tapa.

Skins desbloqueables con fichitas (ver sección 9): porrón, lata, chopp, botella de litro. Los nombres de variedades se leen de `config.ts` para que la marca los defina.

---

## 5. El perseguidor: el Lunes

- Bloque de calendario de pared: rectángulo blanco con franja roja arriba, dos anillas metálicas, texto **LUNES** grande en rojo y el número del día. Usar textura generada con `CanvasTexture` (sin fuentes externas obligatorias).
- Cara enojada (cejas en V, boca gritando), bracitos y piernas que corren con zancadas exageradas.
- Partículas de hojas de calendario volando detrás de él.

Comportamiento:
1. Al empezar la partida aparece justo detrás de la birra, y en ~3 s se queda atrás y sale de cámara.
2. **Tropiezo leve** (choque lateral o rozar un obstáculo): el Lunes reaparece pegado atrás durante ~6 s.
3. **Segundo tropiezo** mientras está cerca → te agarra → game over.
4. **Choque frontal** contra un obstáculo → game over directo.
5. Globos de diálogo random cuando está cerca (editables en `config.ts`):
   - "¿Arrancamos la semana?"
   - "Tenés reunión a las 9"
   - "¿Me mandás eso hoy?"
   - "Se terminó el finde, campeón"
   - "Ya puse la alarma"

Animación de game over: el Lunes salta sobre la birra y una hoja de calendario tapa la pantalla con el texto **"Te agarró el lunes"**.

---

## 6. Escenario: Montevideo por zonas

El mundo se genera por **chunks** (segmentos de ~60 m) que se reciclan. Cada ~800 m cambia la **zona**, con un chunk de transición. El orden de zonas rota y se repite.

Los landmarks van **a los costados de la pista** (nunca en los carriles), en low-poly con la silueta reconocible. Que se entienda de un vistazo, no hace falta detalle arquitectónico.

| Zona | Ambiente | Landmarks y detalles |
|---|---|---|
| **Ciudad Vieja** | Adoquines, calles angostas, faroles | Puerta de la Ciudadela, Plaza Independencia con el **Palacio Salvo** (torre escalonada con cúpula y antena) y la estatua ecuestre de Artigas, Teatro Solís (fachada con columnas), Mercado del Puerto (estructura de hierro + humito de parrilla) |
| **Rambla** | Murito de la rambla de un lado, el río del otro, atardecer | Faro de Punta Carretas, pescadores en el muro, gaviotas, el Cerro con la fortaleza en el horizonte |
| **Pocitos / Parque Rodó** | Edificios altos frente a la playa, arena | Letras grandes de MONTEVIDEO en la rambla de Pocitos, castillito del Parque Rodó, sombrillas |
| **18 de Julio / Centro** | Avenida ancha, mucho tránsito | Palacio Municipal, Fuente de los Candados, Palacio Legislativo al fondo de la avenida |
| **Tres Cruces / Parque Batlle** | Árboles, explanada | **Estadio Centenario** con la Torre de los Homenajes |
| **Puerto / Aguada** | Grúas, contenedores | **Torre de Antel** (silueta triangular escalonada), grúas portuarias |
| **Tristán Narvaja** | Feria de domingo | Puestos con toldos de colores, libros, plantas. Chiste: es la feria del **domingo**, el último refugio antes del lunes |

Ambiente:
- Cielo con degradé; en la Rambla, atardecer naranja-violeta (los atardeceres de la rambla son un clásico).
- Niebla para ocultar el spawn de chunks.
- Opcional (nice-to-have): reloj en el HUD que arranca "Domingo 18:00" y avanza con la distancia; el cielo se va oscureciendo. Al llegar a "Domingo 23:59" se mantiene ahí (nunca llega el lunes mientras corras).

---

## 7. Obstáculos (todos originales y locales)

Cuatro tipos de comportamiento:

| Tipo | Cómo se esquiva | Ejemplos |
|---|---|---|
| **Bajo** | Saltar | Contenedor de basura (verde o gris), cajón de cerveza, conito, mate y termo gigantes tirados |
| **Alto** | Rodar por abajo | Valla de obra elevada, cartel colgante, bandada de gaviotas volando bajo (en la Rambla) |
| **Bloque** | Cambiar de carril | Puesto de feria, carrito de chorizos, vallas de obra completas |
| **Bondi** | Cambiar de carril o subirse arriba por la rampa | Ómnibus estacionado o viniendo de frente (equivalente a los trenes). Tiene una rampa adelante para subirse al techo y correr por arriba |

- Ómnibus, comercios y carteles **sin logos ni nombres de empresas reales**: colores genéricos.
- Siempre tiene que existir al menos un camino posible (validar al generar cada fila de obstáculos).
- La densidad y los patrones se vuelven más difíciles con la distancia.

---

## 8. Coleccionables y power-ups

### Fichitas MBC
- Disco tipo ficha con borde, girando sobre su eje, brillito al recogerlas.
- Textura: `public/assets/brand/ficha-mbc.png` si existe; si no, `mbc-logo.png` sobre un disco dorado/ámbar; si no hay nada, disco ámbar liso con las letras "MBC" en `CanvasTexture`.
- Patrones: líneas rectas en un carril, arcos sobre obstáculos bajos (para guiar el salto), zigzag entre carriles, filas sobre el techo de los bondis.
- Usar `InstancedMesh` para que haya muchas sin costo.

### Power-ups (duración y valores en `config.ts`)
| Nombre | Ícono | Efecto |
|---|---|---|
| **Feriado** | Hoja de calendario tachada | Escudo: absorbe un choque y el Lunes se aleja. Se puede guardar uno y activarlo con doble tap |
| **Happy Hour** | Reloj con chopp | Imán: atrae todas las fichitas cercanas por 10 s |
| **Chopp doble** | Dos choppitos | Multiplicador x2 de puntos por 15 s |
| **Tapita turbo** | Tapita con alitas | Supersalto por 10 s |

---

## 9. Puntaje, progresión y guardado

- **Puntaje:** metros recorridos × multiplicador + fichitas.
- **Velocidad:** arranca moderada y sube con una curva suave hasta un tope (configurable).
- **Guardado local** (`localStorage`, siempre envuelto en `try/catch`; si falla, el juego funciona igual sin guardar): récord, fichitas acumuladas, skins desbloqueadas, mute.
- **Skins:** se compran con fichitas acumuladas. Precios en `config.ts`.
- Opcional: 3 misiones diarias simples ("Juntá 100 fichitas", "Rodá 10 veces", "Pasá por el Centenario").

---

## 10. Pantallas y UI

1. **Age gate** (activable con `config.brand.ageGate`): "¿Sos mayor de 18?" Sí / No. Si dice que no, mensaje amable y no se muestra el juego.
2. **Menú principal:** título "Escapale al Lunes", birra animada corriendo en el lugar, botón **Jugar**, récord, fichitas, Skins, mute.
3. **HUD:** metros, fichitas, multiplicador, power-up activo con barra de duración, botón pausa. Grande y legible en celular.
4. **Pausa:** Seguir / Reiniciar / Menú.
5. **Game over:** "Te agarró el lunes", metros, fichitas de la partida, récord (con festejo si es nuevo), botones **Revancha** y **Compartir** (Web Share API con el texto "Le escapé al lunes X metros por Montevideo 🍺", con fallback a copiar al portapapeles).
6. **Leyenda legal** al pie del menú, configurable (`config.brand.legalText`, por defecto "Tomá con moderación. Prohibida su venta a menores de 18 años.").

Fuentes: una display redondeada y divertida para títulos (Google Fonts, por ejemplo Baloo 2 o Fredoka) y una sans legible para el HUD.

---

## 11. Look & feel

- Low-poly colorido y cartoon, `MeshToonMaterial` o `MeshStandardMaterial` con colores planos.
- **Paleta:** ámbar/dorado birra (`#C8862B`, `#F2B134`), espuma (`#FFF8E7`), celeste uruguayo (`#7FC4E8`), azul profundo (`#1E3A5F`), rojo Lunes (`#E63946`).
- Si existen colores de marca en `config.brand.colors`, tienen prioridad.
- Cámara detrás y arriba de la birra, con FOV que aumenta un poco a mayor velocidad y un leve shake al tropezar.
- Sombras baratas: sombras "blob" (círculo oscuro debajo) o una sola luz direccional con shadow map chico.

---

## 12. Arquitectura sugerida

```
src/
  main.ts
  config.ts              ← TODOS los números, textos, flags y datos de marca
  game/
    Game.ts              ← loop, estados (menu, playing, paused, gameover)
    Input.ts             ← teclado + swipe + buffer
    Player.ts            ← birra: física simple por carril, estados, animaciones
    Chaser.ts            ← el Lunes
    Collision.ts         ← AABB por carril
  world/
    ChunkManager.ts      ← spawn/reciclado de chunks
    zones/               ← una clase por zona (CiudadVieja.ts, Rambla.ts, ...)
    landmarks/           ← builders low-poly (PalacioSalvo.ts, TorreAntel.ts, Centenario.ts, ...)
    Obstacles.ts         ← tipos, pooling, patrones garantizando camino libre
    Collectibles.ts      ← fichitas (InstancedMesh)
    PowerUps.ts
  models/
    Birra.ts             ← builder del personaje + skins
    Lunes.ts             ← builder del perseguidor
  fx/Particles.ts        ← espuma, hojas de calendario, brillos
  audio/Audio.ts
  ui/                    ← HUD y menús en HTML/CSS
  storage/Save.ts
public/
  assets/brand/          ← logo y ficha MBC (los provee la marca)
  assets/audio/
```

Principios:
- Object pooling para obstáculos, fichitas y chunks (nada de crear/destruir en cada frame).
- Merge de geometrías estáticas por chunk; `InstancedMesh` para lo repetido (faroles, árboles, fichitas, adoquines).
- `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`.
- Delta time fijo para la lógica, para que la dificultad no dependa de los fps.
- Pausar automáticamente cuando la pestaña pierde foco.

---

## 13. Assets de marca (los provee el cliente)

Si un archivo no está, usar placeholder neutro y dejar un `TODO(brand)` en el código:

- [ ] `public/assets/brand/mbc-logo.png` (o `.svg`), fondo transparente
- [ ] `public/assets/brand/ficha-mbc.png` (diseño de la fichita, opcional)
- [ ] Colores de marca (hex) → `config.brand.colors`
- [ ] Nombres de variedades para las skins → `config.skins`
- [ ] Texto legal → `config.brand.legalText`
- [ ] Música / jingle (opcional) → `public/assets/audio/`

---

## 14. Fases de desarrollo

Al final de cada fase: `npm run build` sin errores ni warnings de TypeScript, probar en el navegador, commit con mensaje claro.

1. **Prototipo jugable con cajas:** 3 carriles, cambio de carril, salto, rodar, obstáculos cubo de los 4 tipos, fichitas, colisiones, game over, reinicio. Controles de teclado y swipe.
2. **Personajes:** birra y Lunes modelados con sus animaciones; lógica completa del Lunes (tropiezo → se acerca → te agarra).
3. **Montevideo:** sistema de zonas, chunks con landmarks, obstáculos temáticos, cielo y ambiente.
4. **Juego completo:** power-ups, puntaje, velocidad progresiva, guardado, skins, todas las pantallas, sonido.
5. **Pulido y mobile:** rendimiento en celular, partículas, juice (screen shake, squash, brillos), age gate, compartir, deploy.

---

## 15. Criterios de aceptación

- Se juega de punta a punta en un celular con swipes, sin lag notorio.
- Se reconocen al menos 6 lugares de Montevideo de un vistazo (Palacio Salvo, Torre de Antel, Centenario, Puerta de la Ciudadela, Faro de Punta Carretas, Palacio Legislativo).
- El Lunes se entiende como un calendario que dice "LUNES" y su mecánica de persecución funciona (tropiezo → se acerca → segundo tropiezo te agarra).
- La birra rueda como botella al agacharse.
- Las fichitas usan el logo de MBC cuando está en `public/assets/brand/`.
- Nunca se genera una fila de obstáculos imposible.
- Récord y fichitas persisten al recargar (y el juego no se rompe si `localStorage` no está disponible).
- Todos los valores de gameplay, textos y datos de marca se cambian desde `config.ts`.

---

## 16. Reglas para el desarrollo

- **No** usar assets, nombres, personajes, música ni sonidos de Subway Surfers ni de ningún otro juego. Solo la mecánica de género (endless runner de 3 carriles).
- **No** inventar ni dibujar logos de MBC: usar los archivos de `public/assets/brand/` o placeholders neutros.
- Ómnibus, comercios y carteles sin marcas reales.
- Código en TypeScript estricto, comentarios breves en español.
- Ante una duda de diseño, elegir lo más simple, anotarlo en `DECISIONES.md` y seguir.
