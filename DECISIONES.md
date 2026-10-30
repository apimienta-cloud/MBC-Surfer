# Decisiones de diseño

Dudas menores resueltas con la opción más simple, como pide la spec (CLAUDE.md).

## Fase 1: prototipo con cajas

- **Espacio de pista:** la lógica trabaja en `s` (metros recorridos) con `s = -z` en el mundo. La birra avanza de verdad (no se mueve el mundo); a las distancias de una partida la precisión de float alcanza.
- **Choques:** AABB. Se distingue por dónde entró la birra al obstáculo en el paso anterior:
  - **De frente** (antes no había solapamiento en `s`) = choque frontal, game over.
  - **De costado** (cambio de carril contra algo) = rebota al carril de origen y tropieza.
  - **Roce:** si el solapamiento lateral es chico (< `grazeOverlap`) o el bajo se toca apenas en el borde superior (< `lowGrazeHeight`), es tropiezo y no choque.
  - Si la birra está casi a la altura de la tapa (< `stepUp`), se sube en vez de chocar. Sirve para el final de la rampa y para caídas tardías sobre obstáculos bajos.
- **Superficies:** se puede caer y correr arriba de bajos, bloques y bondis (techo); los altos (valla elevada) no tienen superficie.
- **Bondi que viene de frente:** se queda quieto hasta que la birra está a `activateDistance` y recién ahí arranca. Al generarlo se ubica más adelante, para que lo que recorra caiga dentro del tramo que el generador marca como ocupado.
- **Camino garantizado:** el generador lleva el conjunto de carriles donde se puede estar vivo. Antes de cada fila lo expande con cambios de carril posibles (sin atravesar bondis) y exige que cada grupo conectado tenga al menos un carril pasable (libre, bajo o alto). El techo de los bondis cuenta como bonus, no como camino garantizado.
  - Chequeo automático en `src/dev/validateGenerator.ts`: corre en la consola del navegador con el dev server; se probaron 40 partidas de 6 km sin filas imposibles.
- **El Lunes en Fase 1:** caja roja con la lógica completa (intro de 3 s, se acerca 6 s tras un tropiezo, segundo tropiezo = te agarra). En Fase 2 se reemplaza el modelo y se suman globos y animación de captura.
- **Tropiezo durante la intro:** como el Lunes arranca pegado, tropezar en los primeros 3 s ya te agarra.
- **Logo/ficha:** el archivo que mandó la marca es 1920×1080 con fondo naranja (no transparente). Se guardó igual como `mbc-logo.png` y `ficha-mbc.png`; la fichita recorta un cuadrado central (`brand.fichaCropScale`). Cuando llegue una ficha cuadrada o un PNG transparente, se reemplaza el archivo y listo.
- **Colores de marca:** `config.brand.colors` queda vacío con `TODO(brand)` hasta tener los hex oficiales; mientras tanto se usa la paleta de la spec.
- **FOV en vertical:** además del FOV que se abre con la velocidad, hay un FOV horizontal mínimo (`camera.minHorizontalFov`) para que en celular entren los 3 carriles.
- **Build:** subí `chunkSizeWarningLimit` a 800 kB porque Three.js solo ya pasa el límite por defecto de 500 kB y el aviso saldría siempre.
- **Guardado:** ya en Fase 1 se guardan récord y fichitas acumuladas (es poco código y deja probado el `try/catch`).

## Fase 2: personajes

- **El Lunes mira a cámara:** su frente (la hoja que dice LUNES, con la cara) apunta hacia +z, a la cámara, aunque persiga a la birra hacia -z. Si mirara a la birra, el jugador le vería siempre la espalda. Como las zancadas son simétricas, no se nota que "corre de espaldas".
- **El Lunes corre al costado:** mientras persigue va corrido `chaser.sideOffset` hacia el centro de la calle para no tapar a la birra. Se acerca a `nearGap` = 2.6 m: lo bastante lejos de la cámara para que se le vea la cara, y lo bastante cerca para que intimide.
- **La birra se ve de espaldas** (como en todo runner): la etiqueta con el logo da la vuelta completa, así el logo se ve desde la cámara. La cara está al frente y se ve en el menú (la cámara del menú mira a la birra de frente), cuando rueda, cuando tropieza y cuando mira para atrás (lo hace cada 2–4 s si el Lunes está cerca).
- **Rodar:** la botella se acuesta con el eje a lo ancho de la pista y gira sobre su eje según la velocidad. La caja de colisión sigue siendo la de `player.rollHeight`.
- **Número del día del Lunes:** por defecto es el número del próximo lunes (`chaser.dayNumber: 'auto'`); se puede fijar en config.
- **Animación de captura:** nuevo estado `caught`. El Lunes alcanza, salta y cae arriba de la birra (que queda aplastada y con cara de pánico), dice "¡Buen lunes!" y después cae la hoja de calendario de game over. El récord se guarda apenas te agarra, no al terminar la animación.
- **Skins:** `models/Birra.ts` ya arma los 4 envases (porrón, lata, chopp, litro) a partir de un perfil de proporciones. La compra y elección de skins llegan en Fase 4. El chopp es de vidrio translúcido y no lleva etiqueta.
- **Partículas** (`fx/Particles.ts`): espuma al saltar, aterrizar y tropezar; hojas de calendario detrás del Lunes; brillitos al juntar fichitas. Son 3 InstancedMesh con pool circular: si se llena, se pisa la partícula más vieja.
- **Menú:** título arriba y botones abajo, para que la birra corra en el lugar en el medio de la pantalla. La transición al juego es un travelling de cámara.

## Fase 3: Montevideo

- **Zonas:** cada zona ocupa `round(800 / 60)` = 13 chunks y después viene uno de transición, con un cartel vial verde ("→ Rambla") y una mezcla neutra. El orden sale de `config.zones.order`, empieza siempre en Ciudad Vieja y se repite. Al entrar a una zona aparece un cartel con su nombre.
- **Modelos con el Kit** (`world/landmarks/kit.ts`): cada modelo se arma con primitivas de Three.js y colores por vértice, y se fusiona en una sola geometría con un material compartido (sombreado plano). Eso da un draw call por landmark, edificio u obstáculo. Las geometrías se arman una sola vez y se reutilizan; un landmark se reemplaza por un `.glb` cambiando su builder en `landmarks/index.ts`.
- **Props repetidos** (faroles, árboles, palmeras, sombrillas, puestos, contenedores, murito, pescadores): `InstancedMesh` global por tipo, con un rango de instancias por chunk. El toldo, la copa o el contenedor toman el color de la instancia.
- **Landmarks visibles de lejos:**
  - En el chunk de un landmark grande no hay edificios de ese lado (queda una plaza).
  - Algunos se giran hacia la birra que se acerca (`angle`), por ejemplo las letras de MONTEVIDEO, que de canto no se leían.
- **Horizonte:** el Cerro (Rambla), el Palacio Legislativo al fondo de 18 de Julio y la Torre de Antel (Puerto) son siluetas sin niebla que acompañan a la birra a distancia fija, teñidas con el color del horizonte. Aparecen y desaparecen con la zona. La Torre de Antel aparece también al costado de la calle en el Puerto.
- **Escala:** los landmarks están achicados respecto a los reales (el Salvo mide ~60 m con antena, la Torre de los Homenajes ~40 m) para que entren en cuadro con la cámara baja del runner.
- **Cielo:** degradé por zona (atardecer naranja-violeta en la Rambla); la niebla usa el color del horizonte. En el chunk de transición los colores se mezclan.
- **Reloj:** HUD con "Domingo 18:00" que avanza 1 minuto cada 15 m. A las 23:59 (a ~5,4 km) se queda ahí. Con la hora va cayendo la noche, nunca del todo (`night.maxDarkness`), y se prenden los faroles.
- **Obstáculos temáticos:** la variante visual depende de la zona (`config.zones.obstacles`); la caja de colisión sigue siendo la del tipo. Algunas zonas ajustan pesos: más altos en la Rambla (gaviotas), más bondis en 18 de Julio, más puestos en Tristán Narvaja.
  - Los ómnibus usan 4 combinaciones de colores genéricas, sin nombres ni logos.
  - El que viene de frente muestra la trompa y el estacionado la cola, con la rampa detrás.
- **Humo de parrilla:** la chimenea del Mercado del Puerto emite partículas cuando la birra está cerca.
- **Rendimiento:** quedaron ~130–180 draw calls y ~80–130k triángulos según la zona. Las ventanas son planos de 2 triángulos y las `InstancedMesh` solo dibujan hasta la última instancia usada. En Fase 5 se puede fusionar la decoración por chunk si hace falta.
- **Herramienta de dev:** `src/dev/snap.ts` saca capturas en cualquier distancia para revisar zonas desde la consola.

## Fase 4: juego completo

- **Puntaje:** suma metros × multiplicador (x2 con Chopp doble) más 1 punto por fichita. El récord del menú es el puntaje; la mejor distancia también se guarda.
- **Feriado:** al agarrarlo se guarda (uno solo) y se activa con doble tap, E o el botón del HUD. Si ya hay uno guardado, el siguiente se activa al toque. Es un escudo que dura 12 s o hasta absorber un choque; después del choque quedan 1,2 s de invulnerabilidad, y el Lunes se aleja.
- **Tapita turbo:** el salto llega a ~4,5 m y deja caer arriba de bloques y bondis. Si caés desde arriba sobre algo alto, lo atravesás.
- **Power-ups:** aparecen cada 240–420 m, entre dos filas y en un carril alcanzable.
- **Misiones diarias** (opcionales en la spec): 3 por día, elegidas según la fecha. Cada una da 50 fichitas. "Corré X m" y "Pasá por el Centenario" se miden por partida; las demás se acumulan en el día.
- **Skins:** se compran con las fichitas acumuladas. Las tarjetas muestran una silueta CSS del envase, y la birra del menú cambia al elegir.
- **Sonido:** todo sintetizado con Web Audio. Si existe `public/assets/audio/musica.mp3`, se usa como música en lugar del loop sintetizado. El mute se guarda.
- **Compartir:** usa la Web Share API; si no está disponible, copia el texto al portapapeles.

## Fase 5: pulido y mobile

- **Age gate activado por defecto** (`config.brand.ageGate: true`), porque es una marca de cerveza.
  - El "sí" se guarda para no preguntar en cada visita.
  - El "no" muestra un mensaje amable y el juego (canvas incluido) no se carga. No se recuerda: si recargás, vuelve a preguntar.
- **Calidad adaptativa** (`config.quality`): con el promedio de fps por debajo de 48 durante ~2 s, baja la resolución interna 0,25 por escalón, hasta pixel ratio 1. Con más de 58 fps durante ~8 s, vuelve a subir. Ignora los saltos grandes (pestaña en segundo plano). Es la palanca más barata para celulares de gama media; la escena ya está entre 80k y 130k triángulos.
- **Juice:**
  - El contador de fichitas rebota al juntar.
  - La cámara baja un toque al aterrizar.
  - Shake chiquito al agarrar un power-up.
  - Aviso "¡Superaste tu récord!" en plena partida.
  - Las barras de power-ups se actualizan a 10 Hz, no en cada frame.
- **Mobile:**
  - Meta tags para pantalla completa al agregar a inicio (iOS y Android).
  - El audio se habilita con el primer toque en cualquier lado (iOS lo exige).
- **Deploy:** quedan listos `netlify.toml` y el workflow de GitHub Pages (`.github/workflows/deploy.yml`). No se publicó nada: hace falta la cuenta de la marca.
- **Finales de línea:** `.gitattributes` fija LF para no mezclar CRLF en Windows.
- **Fichitas en zigzag:** cuando la línea guía cambia a un carril vecino, cruza en diagonal entre dos filas (`coins.zigzagLength` m), y solo si ninguno de los dos carriles tiene un bondi en ese tramo. Las fichitas nunca caen dentro de un obstáculo: el cruce termina antes de la fila siguiente.

## Locales de MBC en el mapa (fotos de la marca)

- **No se pegan fotos sueltas en el mundo low-poly:** se usan recortes puntuales de las fotos como texturas, sobre modelos hechos con el Kit e inspirados en cada local:
  - **Casa MBC** (Pocitos, chunk 5): la casona blanca con el patio cervecero, guirnaldas, reja, pérgola, el cartel redondo en poste y la luz verde/cálida sobre la fachada.
    - Antes de la casa van casas bajas para que se vea de lejos.
    - El nombre "MONTEVIDEO BEER COMPANY" de la fachada es texto (`config.brand.locales.facadeName`), no un logo dibujado.
  - **Galpón MBC** (Puerto/Aguada, chunk 4): el cubo de chapa corten con ventanales que se prenden de noche, el cartel redondo y un mural de carteles retro.
    - El mural tiene paneles de colores y formas sin texto: el de la foto lleva marcas de terceros.
  - **Escenario MBC** (Parque Rodó, chunk 9): tablado con banda y las letras luminosas recortadas de la foto del escenario.
  - **Gigantografías:** una por zona en el chunk 2 (dos en 18 de Julio), con fotos de los locales y el cartel redondo en la esquina. Están giradas hacia la birra que se acerca.
- **Fotos que se usan:**
  - Cartel del poste → `cartel-mbc.png`, el logo real recortado de la foto.
  - Letras del escenario → `letras-mbc.png`, recortadas con transparencia.
  - Canillas, pared con el sello MBC, galpón y casa → gigantografías 2:1.
- **Fotos que no se usan:**
  - Las que tienen gente en primer plano (caras reconocibles).
  - La pizarra de canillas, porque nombra otras cervecerías.
  - El mural con carteles de otras marcas.
  - Del galpón se recortó el cartel de un local vecino que aparece en el borde.
- **Ubicación en el mapa:** la Casa MBC va en Pocitos porque la foto muestra la esquina de Bv. España y Dr. Enrique Muñoz. El galpón va en Puerto/Aguada por su estética industrial; si está en otra zona, se mueve cambiando una línea en `zones/`.
- **De noche:** guirnaldas, carteles, ventanales y bañados de luz usan materiales registrados en `glowEmissive` / `glowOpacity` (`landmarks/kit.ts`), que el ChunkManager prende según la oscuridad del cielo.

## Skins con los productos reales de MBC

- Las 4 skins genéricas pasan a ser los productos reales, sacados de las fotos de producto:
  - **Porrón MBC** (gratis).
  - **Latas Blonde Ale, Session IPA, Red Ale y Honey.**
  - **Pinta MBC.**
  - **Botellón recargable.**
- **Latas:** la etiqueta real se "desenrolla" del frente de cada lata (cada columna de la textura es un ángulo del cilindro), se repite en el frente y en la espalda (la que ve la cámara), y el resto se rellena con el color de la lata y la franja negra.
- **Vidrio (porrón, botellón, pinta):** el print se hizo con las letras del **logo oficial** (`mbc-logo.png`), no con el recorte de la foto: los reflejos del vidrio ensuciaban el recorte. Va en blanco horizontal en las botellas y en negro vertical en la pinta, como en los productos.
- **Formas nuevas:** `pinta` (vaso recto que se angosta abajo) y `growler` (botellón con asa y tapa negra). `chopp` y `litro` siguen disponibles en el código.
- **Compras guardadas:** las skins con ids viejos se migran (`config.skinRenames`: lata → blonde, chopp → pinta, litro → botellon), así nadie pierde lo que compró.
- **Pantalla de skins:** cada tarjeta muestra la foto del producto (miniaturas de ~6 KB).
- **Gigantografías nuevas:** las 4 latas, latas y botella sobre fondo claro, y el botellón con la pinta.

## Paseo MBC: la primera zona, con los locales

- **Problema:** los locales y las fotos aparecían tarde (la Casa MBC a ~2 km), y la mayoría de las partidas termina antes.
- **Solución:** cada vuelta del mapa arranca en **Paseo MBC** (~800 m), y el resto de las zonas viene después (`config.zones.order`). La zona tiene:
  - **Locales:** la Casa MBC, el galpón, el escenario y patios cerveceros (`patioMBC`: intertrabado, mesas de picnic, barriles con banquetas, guirnaldas, reja baja y cartel sobre el portón), alternando de lado.
  - **Calle:** guirnaldas cruzando la calle cada 15 m (a 7,6–8,6 m de altura, para que no tapen la cámara) y carteles redondos MBC en poste en las veredas (props instanciados con el recorte del cartel real, que se prenden de noche).
  - **Gigantografías** cada dos chunks y edificios de chapa corten (estilo `corten`) entre casonas.
  - **Obstáculos propios:** barriles y mesa de picnic (bajos), cartel colgante con el logo (alto, se pasa rodando) y barra móvil con canillas y cartel (bloque).
- **Menú:** lo que hay detrás de la largada (chunk -1) también es Paseo MBC, así el menú muestra a la birra en la calle de los locales, con la Casa MBC y el galpón.
- **Gigantografías antes en las otras zonas:** pasaron del chunk 2 al chunk 1 de cada zona.
- **Rendimiento:** el Paseo MBC es la zona más cargada (hasta ~215 draw calls); el resto sigue en 130–180. Si en algún celular se nota, se puede poner un local cada dos chunks.

## Más marca y más vida (logos, fuentes, fotos de los locales)

- **Logos oficiales:** del PNG blanco con transparencia salen `logo-blanco.png`, `logo-negro.png` y `logo-dorado.png`.
  - El dorado oficial (`#EBAB43`, sacado del logo) queda en `config.brand.colors.gold` y tiene prioridad sobre la paleta.
  - Usos: menú y age gate (arriba del título), fachada de la Casa MBC (reemplaza el texto en Georgia), neón dentro del galpón, pantalla LED del escenario y afiches.
- **Fuentes de la marca (Eatbreak de Holis Majid, Vanguard CF de Connary Fagen):** **no se suben al repo ni a la web**. Son licencias de escritorio y el repo es público; para usarlas en vivo en el HUD hace falta licencia webfont.
  - Con ellas se generaron **imágenes**: el título "ESCAPALE AL LUNES" en Eatbreak y dos afiches con slogans de la marca ("Good people drink good beer" de la remera y "¡Viva la birra!" de la pared del local).
  - El HUD sigue con Baloo 2 / Nunito (Google Fonts).
- **Fotos nuevas → gigantografías:**
  - Usadas: el galpón con guirnaldas, el neón y las letras MBC, la barra, las canillas con gorros y botellones, el patio de la casa y las pantallas del festival.
  - Recortadas siempre: marcas de terceros (mural, Petrobras, Peugeot, el hotel, los sponsors del festival, la pizarra con otras cervecerías) y caras en primer plano.
  - La foto de la multitud en la noche no se usa (caras).
- **Locales más fieles a las fotos:**
  - **Galpón:** patio adelante con intertrabado, mesas altas en tachos rojos, banquetas negras, palmeras, combi roja y blanca (sin marcas), macetas de tacho, reja de alambre, guirnaldas en la fachada y el cartel grande en poste junto a la vereda.
  - **Casa:** árboles de hoja colorada (los de la foto del patio) y barriles de acero.
  - **Escenario:** público con los brazos arriba y pantalla LED con el logo.
- **Gente:** figuras low-poly sin cara (sentadas en las mesas, paradas con un vaso), metidas en la geometría de cada local. Además, peatones instanciados en las veredas de casi todas las zonas (remeras de colores, un vaso en la mano).
- **Un punto MBC en cada zona:** un patio cervecero en Ciudad Vieja, Rambla, 18 de Julio, Tres Cruces, Puerto y Tristán Narvaja. Pocitos ya tiene la Casa y el escenario.

## Fichas derechas, del jueves al lunes que nunca llega y ranking con Instagram

- **Fichas:** las tapas del cilindro traían la textura girada 90°. Se remapean las UV para que "MBC" quede derecho; la cara de atrás va espejada para que también se lea bien cuando la ficha gira.
- **Reloj (reemplaza "Domingo 18:00 → 23:59"):**
  - Arranca el **jueves a las 21:00** y pasa por viernes, sábado y domingo, con días y noches: amanece de 5:30 a 7:30 y anochece de 18:30 a 20:30, con el horizonte naranja en las transiciones.
  - **El lunes nunca llega:** lo que falta para el lunes (00:00) se reduce a la mitad cada 2.800 m (`config.clock.halfLifeMeters`). El reloj se va frenando: a 1 km es viernes al mediodía, a 6 km domingo a la mañana y a 15 km domingo 22:10.
  - En la última hora aparecen los segundos para que se note que el tiempo casi no avanza. El texto nunca pasa de "Domingo 23:59:59".
  - De noche oscurece más que antes (`maxDarkness` de 0,72 a 0,86) para que se note el ciclo. Los faroles y los locales se prenden igual que antes.
- **Ranking:**
  - La gente se anota con su **usuario de Instagram**: se acepta "@usuario", "usuario" o el link del perfil, y se valida con las reglas de IG (letras, números, puntos y guiones bajos; hasta 30).
  - Se sube el **mejor puntaje** de cada usuario. El game over muestra el puesto ("Estás #12 en el ranking") o, si no está anotado, el botón "Anotate en el ranking".
  - **Servidor:** una planilla de Google Sheets con un script de Apps Script publicado como aplicación web (`apps-script/Ranking.gs`). Se eligió en lugar de Supabase para no abrir otra cuenta y porque el equipo puede mirar, ordenar y exportar el ranking como cualquier planilla (hoja "Top").
    - El juego le habla por POST con `text/plain` para que el navegador no haga preflight, que Apps Script no contesta.
    - Las escrituras usan un lock y el top se cachea 20 s.
    - Aguanta tráfico moderado (Apps Script limita las ejecuciones simultáneas). Si el juego explota, conviene pasar a Cloudflare Workers con la misma API.
  - Mientras `config.ranking.endpoint` esté vacío, el ranking funciona solo en el dispositivo y lo avisa en pantalla.
  - **Nadie puede pisar el usuario de otro:** al anotarse, cada dispositivo genera un secreto y la planilla guarda solo su hash. Para subir puntajes con ese usuario hay que tener el mismo secreto.
  - **Límites conocidos:**
    - No se verifica que la cuenta de IG sea de quien la anota; eso requiere login con Instagram/Meta. Gana el primero que anota el usuario.
    - Si alguien borra los datos del navegador, pierde el usuario. Se libera borrando su fila en la hoja "Jugadores".
  - **Antitrampa básico:** el servidor rechaza puntajes que no son creíbles para los metros recorridos (más de 3 puntos por metro). No es infalible: un juego 100 % en el navegador no puede evitar todas las trampas. Si se van a dar premios, conviene revisar el top a mano.
