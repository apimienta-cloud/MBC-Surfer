# Escapale al Lunes

Endless runner 3D para navegador (mobile first): una birra corre por Montevideo juntando fichitas de MBC mientras la persigue el Lunes.

- Spec completa: [CLAUDE.md](CLAUDE.md)
- Decisiones de diseño: [DECISIONES.md](DECISIONES.md)
- Todo lo tuneable (velocidades, textos, colores, precios, marca): [`src/config.ts`](src/config.ts)

## Correr en local

```bash
npm install
npm run dev
```

`npm run dev` levanta Vite con `--host`, así que también se puede abrir desde el celular en la misma red (la URL "Network" que muestra la terminal).

## Build

```bash
npm run build
```

Genera el sitio estático en `dist/` (rutas relativas, funciona en cualquier subcarpeta).

## Deploy

- **Netlify:** conectar el repo; `netlify.toml` ya define `npm run build` y la carpeta `dist`. También se puede arrastrar la carpeta `dist/` a app.netlify.com/drop.
- **GitHub Pages:** subir el repo a GitHub, ir a *Settings → Pages → Source: GitHub Actions*. El workflow `.github/workflows/deploy.yml` publica en cada push a `main`.

## Assets de marca

Van en `public/assets/brand/` (si falta alguno se usa un placeholder neutro, marcado con `TODO(brand)` en el código):

- `mbc-logo.png`: etiqueta de la birra (ideal: PNG con fondo transparente)
- `ficha-mbc.png`: cara de las fichitas (se recorta un cuadrado central)
- Colores de marca → `config.brand.colors`
- Nombres de variedades para las skins → `config.skins`
- Texto legal → `config.brand.legalText`
- Música opcional → `public/assets/audio/musica.mp3`

## Herramientas de desarrollo

Con `npm run dev` abierto, en la consola del navegador:

```js
// Simula partidas y verifica que nunca haya una fila imposible
const v = await import('/src/dev/validateGenerator.ts'); v.validate(30, 6000)

// Capturas en distintas distancias para revisar zonas y landmarks
const s = await import('/src/dev/snap.ts'); await s.grid([0, 900, 1800, 2600]); s.close()
```

## Ranking online (Supabase)

Mientras `config.ranking` esté vacío, el ranking funciona solo en cada dispositivo. Para conectarlo:

1. Crear un proyecto gratis en [supabase.com](https://supabase.com).
2. En **SQL Editor**, pegar y ejecutar [`supabase/ranking.sql`](supabase/ranking.sql).
3. En **Project Settings → API**, copiar la *Project URL* y la clave *anon public*, y pegarlas en `config.ranking.supabaseUrl` y `config.ranking.supabaseAnonKey`. La clave anon es pública: la tabla no se puede tocar directo, todo pasa por las funciones del SQL.
4. Para ver o borrar jugadores: **Table Editor → players**.
