# Audio

El juego genera todos los efectos por síntesis (Web Audio), así que no hace falta ningún archivo.

Opcional:

- `musica/`: lista de temas de bandas (ver `musica/README.md`). Si hay alguno, tiene prioridad.

- `musica.mp3`: si existe, se usa como música de fondo en loop en lugar de la música sintetizada.
  La ruta se configura en `src/config.ts` → `audio.musicFile`. TODO(brand): jingle de la marca.
