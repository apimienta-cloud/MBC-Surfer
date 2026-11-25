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
  - Los ómnibus usan líneas reales de Montevideo (ver más abajo), sin nombres ni logos de empresas.
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

## Ómnibus de Montevideo, taxis y pelusas en el Parque Rodó

- **Ómnibus con líneas reales** (`config.colors.bondiLines`), a pedido de la marca y con fotos de referencia:
  - **526 MALVIN:** verde entero con rayas de colores en la trompa.
  - **104 PZA INDEPENDENCIA, 191 INSTRUCCIONES y 128 POCITOS:** blancos con la parte de abajo azul, filete rojo y franjas rojas y azules en el techo.
  - Cartel de recorrido de leds naranja adelante y el número atrás (los estacionados muestran la cola). Los carteles se ven prendidos de noche.
  - Se copian colores, números y destinos, no logos ni nombres de empresas.
- **Taxi (tipo de obstáculo nuevo):** blanco con franja amarilla, damero sobre la rueda de atrás y copete de TAXI que se prende de noche.
  - Mide 4,4 m de largo y 1,45 m de alto: se esquiva cambiando de carril o se salta al techo (hay que saltar unos 3 m antes) y se sigue corriendo arriba.
  - Para el generador cuenta como pared, igual que los bloques, así que nunca es el único camino. Marca su carril como ocupado mientras dura, como un bondi corto, para que no queden fichitas ni power-ups adentro.
  - Aparece en todo el mapa y más en 18 de Julio y Pocitos. Para no endurecer el juego, el peso de los bloques bajó de 2 a 1,2: la proporción de "paredes" queda casi igual que antes.
  - Sin número de radiotaxi ni logos: solo "TAXI" en el copete y en las puertas.
- **Pelusas en el Parque Rodó:** las de los plátanos en primavera. Pelotitas amarillas que flotan con brisa y vaivén, solo en los tramos del parque (`config.particles.fluff`). Aparecen delante de la birra, así que se cruzan al correr, y duran unos segundos.

## Cinemática de entrada (grafiti PINTA VERNOS) y cinemática final con logros

- **Intro (`src/cinematics/Intro.ts`, `config.intro`):** al abrir el juego, la birra pinta un grafiti en una pared que está detrás de la largada.
  - El grafiti es una imagen (`public/assets/brand/grafiti-pinta-vernos.png`) armada con el logo oficial de MBC y el claim **PINTA VERNOS** en la fuente Eatbreak, con chorreados y sombra de aerosol. No se inventa el logo: se usa el archivo de marca. Como la fuente va dentro de la imagen, el juego no tiene que cargarla.
  - **Fases:** agita la lata (con ruido de bolita), pinta el logo y después el claim, la cámara se abre y muestra la pared entera, y la birra saluda y se va a la largada. Termina exactamente en la cámara del menú, así que el grafiti queda de fondo.
  - **Pintado:** una máscara se va pintando con toques de aerosol en zigzag, solo donde la imagen tiene pintura (zonas en `config.intro.graffiti.regions`). La birra sigue la boquilla con el brazo, salta para llegar arriba y salen gotitas del color de cada parte.
  - **Duración:** unos 12 s. Se saltea tocando la pantalla o con cualquier tecla, y se apaga con `config.intro.enabled = false`.
- **Cinemática final (game over):** se esconden obstáculos, fichitas y el Lunes, y la cámara se acerca a la birra.
  - **Pose:** festeja con brillitos si hizo récord y, si no, saluda.
  - **Encuadre:** en horizontal la birra queda a la izquierda y la tarjeta a la derecha; en celular, la birra arriba y la tarjeta abajo. La distancia de la cámara se calcula con el FOV para que la birra siempre ocupe lo mismo de pantalla.
  - **La tarjeta:**
    - El puntaje sube contando con tics. Después aparecen los metros y las fichitas, y el récord, con papelitos si es nuevo.
    - Los **logros** entran de a uno: hasta qué hora aguantó, a qué zona llegó, saltos, rodadas, techos de bondi, power-ups y misiones cumplidas en la partida (en dorado).
    - Los botones aparecen al final. Tocando en cualquier lado se ve todo de una.
  - Los textos están en `config.texts` (con singular y plural) y los tiempos en `config.results`.

## Look más profesional: sombreado suave, sombras reales y posproceso

- **Pedido:** que se vea más pro, con menos "formitas" y polígonos. Se mantiene el estilo cartoon de la spec, pero pulido como un juego mobile actual. No se pasó a realista: con modelos armados por código no queda bien y en celular pesaría mucho.
- **Modelos (`kit.ts`):**
  - Sombreado suave en vez de facetado.
  - Cilindros y conos con 20 lados, y esferas y cúpulas más redondas.
  - Copas de árboles y arbustos con `blob`: esferas deformadas con ruido, así parecen follaje y no pelotas.
  - Peatones con piernas, brazos y torso de cápsulas en vez de cajas.
- **Luz (`src/fx/Look.ts`, `config.graphics`):**
  - **Tono:** tone mapping neutro de Khronos, que respeta los colores de marca.
  - **Reflejos:** un "estudio" que les da brillo a la birra, los autos y los metales.
  - **Sol con sombras reales** que sigue a la birra.
    - El cuadro de sombras se corre hacia adelante y se ajusta a la grilla para que no titile.
    - El sol viene alto y desde atrás: las sombras de los edificios cubren las veredas sin tapar toda la calle, y la sombra de la birra cae delante de ella.
    - El relleno del cielo bajó para que las sombras se lean.
    - Sigue habiendo una sombra de contacto suave debajo de la birra.
- **Posproceso:**
  - Brillo (bloom) solo en las luces fuertes (faroles, guirnaldas, carteles), más intenso de noche.
  - Viñeta y un toque de contraste y saturación.
  - Antialias MSAA.
- **Oclusión ambiental (n8ao): solo en compu.**
  - Oscurece rincones, bases de edificios y debajo de los árboles.
  - Pesa ~120 kB comprimida y es cara para la GPU, así que se descarga aparte y solo si el dispositivo no es táctil. Con ella, el antialias pasa a SMAA.
  - n8ao importa la librería "postprocessing" para una variante que no usamos. Se reemplaza por un stub (`src/fx/postprocessing-stub.ts`, alias en `vite.config.ts`).
- **Celular:** sombras de 1024 en vez de 2048 y bloom a menor resolución.
- **Calidad adaptativa:** si con la resolución al mínimo sigue lento, se apaga primero la oclusión y después el brillo.

## Pinta Vernos: la juntada con la amiga

- **Nombre nuevo:** "Pinta Vernos" (antes "Escapale al Lunes"). Cambian el título de la página, el logo del título (regenerado con la fuente Eatbreak de la marca), el texto para compartir y el nombre del paquete.
- **La historia:** una cervecita quiere juntarse con su amiga, otra cervecita que corre adelante.
  - La amiga va adelante y es infinita: la alcanzás, brindan, y se vuelve a adelantar un poco más lejos. Así sigue siendo un endless runner y cada juntada es una meta corta.
  - El Lunes sigue de villano por ahora (pedido del cliente: "de momento que siga el lunes").
  - Cómo te acercás: el tiempo corriendo sin tropezar, las fichitas (le dan un uso más a juntarlas) y un tropiezo te aleja. Todos los números en `config.friend`.
  - La amiga esquiva sola con las mismas reglas de salto y rodada que la birra, para que nunca atraviese un obstáculo.
  - En el brindis se pone al costado (del lado del centro de la calle) y las dos se giran para mirarse: si quedaba delante, la cámara la tapaba con la birra.
  - La skin de la amiga es distinta a la tuya, así se distinguen.
- **Escenario más detallado:** las ventanas ahora tienen vidrio brillante (un atributo `gloss` por vértice en el kit, que baja la rugosidad y sube el metal), marco, dintel, alféizar y parteluz. Los edificios coloniales sumaron zócalo, molduras, puerta de madera y balcones con baranda; los de departamentos, barandas de vidrio y hall vidriado.
- **Birra mejorada:** envase torneado de una pieza en vez de cilindros apilados, barniz brillante, gotitas de condensación en el vidrio, ojos con brillito que parpadean, pulgar en el guante y zapatillas con suela. Todas las piezas con más segmentos para que no se vean facetas.
- **Modelos 3D "de verdad":** todo sigue hecho por código. Modelos esculpidos (Blender, `.glb`) necesitan un artista 3D o un pack con licencia libre. Los constructores (`Birra`, `Lunes`, edificios) se pueden cambiar por un modelo cargado sin tocar el resto del juego.

## Piso y cielo con textura

- **Texturas generadas, no archivos:** asfalto, baldosas, pasto, arena, hormigón y olas se hornean en canvas al arrancar (ruido periódico, así se repiten sin costura). No suman peso a la descarga.
- **Coordenadas del mundo:** el piso usa la posición xz en vez de las UV, así las franjas de 80 o 220 m no estiran la textura y no se notan los cortes entre chunks. Se resta el origen de cada chunk redondeado para no perder precisión a miles de metros.
- **Baldosas montevideanas** de 40 cm con 3x3 panes, en gris claro y teñidas con el color de vereda de cada zona. Cordón de granito en bloques de 1,5 m y una cuneta oscura junto al cordón.
- **Agua:** dos capas del mismo mapa de olas que se mueven en direcciones distintas, poco rugosa para que el sol y el cielo brillen encima.
- **Cielo:** nubes con ruido en el shader del domo, proyectadas sobre un plano alto; se mueven con el viento y "pasan" a medida que la birra avanza. De noche se oscurecen y aparecen estrellas.

## Ciudad de fondo, gente y árboles nuevos

- **Que no se vea el horizonte:** detrás de las cuadras hay dos filas de edificios altos (cajas instanciadas en un solo draw call) con ventanas, planta baja vidriada y fajas dibujadas por shader en coordenadas del mundo. De noche se prenden ventanas al azar. Se ubican detrás de lo más lejano que haya puesto la zona (landmarks, casas del parque) para no pisar nada.
- **Silueta lejana:** un cilindro alrededor de la cámara, a 340 m, con dos capas de edificios (atrás más altos y del color de la bruma, adelante más oscuros) y lucecitas de noche. Tapa el fondo de la avenida, donde antes se veía el horizonte.
- **El mar se sigue viendo:** en Rambla, Pocitos y Puerto (`backdrop.left = false`) no hay ciudad de fondo del lado izquierdo y la silueta lejana se apaga hacia ese lado. En la transición entre zonas se mezcla de a poco.
- **Gente con variedad:** cuatro modelos con cara, pelo, zapatillas y mangas: con un vaso de birra, una chica con mate y termo (bien uruguayo), un pibe con gorra y mochila saludando y un señor de boina con bigote. La variante sale de la posición, así las zonas no cambian. Se armaron con pocos segmentos y sin sombra propia (son chicas en pantalla y eran lo más caro de dibujar).
- **Árboles:** tres formas (plátano de vereda, copa redonda, alto) con la copa hecha de muchas masas chicas y sombreado horneado (más oscuro abajo y adentro). Un 14 % son jacarandás violetas, como Montevideo en noviembre. Palmeras con tronco anillado y algo curvo, y hojas arqueadas con folíolos en V.

## Gente más desarrollada

- **Menos "formitas":** las personas dejaron de ser cápsulas. Cada parte es una pieza torneada con su silueta: tobillo, pantorrilla, rodilla y muslo; cadera con cinturón y hebilla; torso con cintura, pecho y hombros; brazos con codo y muñeca; manos ovaladas con pulgar; zapatillas con suela.
- **Cara:** cabeza con mentón más angosto que el cráneo, orejas, ojos con blanco e iris, cejas, nariz y boca. El pelo es un casquete un poco más grande que la cabeza, que deja la frente libre y baja en la nuca; la chica tiene melena y flequillo, el pibe gorra con visera y el señor boina y lentes.
- **Ropa:** remera con cuello y manga corta con dobladillo, buzo con capucha caída, suéter de manga larga con puños, jean, pollera y jogging. La prenda de arriba toma el color de la instancia.
- **Vida:** un shader las hace respirar, balancearse apenas y girar la cabeza despacio cada tanto, con una fase distinta por persona (sale de su posición).
- **Costo:** tienen más detalle, pero se reservan menos lugares por chunk (18 por variante) y no hacen sombra propia, así que el total dibujado quedó igual que antes.

## Lista de temas

- **Lista en vez de un loop:** `audio.playlist` tiene un tema por banda (La Champions Liga, 18 Kilates, Marka Akme, El Chili Fernández, La Nueva Escuela, La Planta). Al jugar se pasan uno tras otro en orden aleatorio; al dar la vuelta se mezcla de nuevo sin repetir el último. La pausa deja el tema a medias y sigue desde ahí.
- **Solo lo que existe:** al cargar se pregunta por cada archivo y quedan los que están. Si no hay ninguno, suena `musica.mp3` y, si tampoco está, la música sintetizada de siempre. Un archivo roto se saca de la lista y se pasa al siguiente.
- **"Sonando":** cuando arranca un tema aparece abajo a la izquierda la banda (y el tema, si se cargó en `tema`) durante unos segundos. En el celu va más arriba para no chocar con los avisos.
- **Los archivos no vienen con el juego:** son canciones con derechos de autor. Hay que conseguirlas con permiso de los dueños (sello o banda) antes de subirlas, porque el sitio es público.
