'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import styles from './FreidoraStation.module.css';

/* ============ CONFIGURACIÓN ============
   Todas las medidas están en píxeles de la imagen Freidora.png (1671 x 941).
   Cada caja es [x, y, ancho, alto]. El componente las convierte a % solo. */
const W = 1671;
const H = 941;
const FONDO = '/Freidora.png';
const IMG_CRUDAS_PILA = '/papas-crudas-pila.png';   // pila que viaja a la freidora
const IMG_COCIDAS = '/papas-fritas-nucleo.png';     // relleno de la canasta al terminar
const IMG_PORCION = '/papasFritas.png';            // pila terminada (viaja y queda en la bandeja)

// Las pilas mantienen siempre su proporción (alto = ancho x PROPORCION)
const PROPORCION = 861 / 1019;
const pila = (cx, cy, ancho) => [cx - ancho / 2, cy - (ancho * PROPORCION) / 2, ancho, ancho * PROPORCION];

const FRY_MS = 5000;                      // tiempo en la freidora
const DURACION_VUELO = 1200;              // cuánto tardan las papas en viajar (ms)
const PAPAS_ANCHO = 420;                       // probá 380, 420, 460...
const PAPAS_ALTO = PAPAS_ANCHO * 0.845;        // mantiene la proporción de la imagen
const BANDEJA_PAPEL = [1435 - PAPAS_ANCHO / 2, 520 - PAPAS_ALTO / 2, PAPAS_ANCHO, PAPAS_ALTO];
const MESADA_PAPAS = [12, 205, 210, 210];    // papas crudas de la mesada (zona tocable)

// region = recorte de la canasta (incluye el mango) para poder "levantarla"
// interior = zona donde van las papas dentro de la canasta
// poly = contorno del recorte (canasta + mango), en coordenadas de la región
const CANASTAS = [
  {
    region: [505, 238, 250, 527],
    interior: [524, 258, 212, 355],
    poly: [[5,5],[245,5],[245,390],[134,390],[134,525],[80,525],[80,390],[5,390]],
  },
  {
    region: [850, 238, 250, 527],
    interior: [869, 258, 200, 355],
    poly: [[3,5],[233,5],[233,390],[158,390],[158,525],[103,525],[103,390],[3,390]],
  },
];

// Cuánto sube la canasta al terminar (escala y desplazamiento en px de la imagen)
const SUBE_ESCALA = 1.12;
const SUBE_DY = -14;

/* ============ AYUDAS ============ */
const caja = ([x, y, w, h]) => ({
  left: `${(x / W) * 100}%`,
  top: `${(y / H) * 100}%`,
  width: `${(w / W) * 100}%`,
  height: `${(h / H) * 100}%`,
});

const cajaEn = ([x, y, w, h], [rx, ry, rw, rh]) => ({
  left: `${((x - rx) / rw) * 100}%`,
  top: `${((y - ry) / rh) * 100}%`,
  width: `${(w / rw) * 100}%`,
  height: `${(h / rh) * 100}%`,
});

const spriteFondo = ([rx, ry, rw, rh], poly) => ({
  backgroundImage: `url(${FONDO})`,
  backgroundSize: `${(W / rw) * 100}% ${(H / rh) * 100}%`,
  backgroundPosition: `${(rx / (W - rw)) * 100}% ${(ry / (H - rh)) * 100}%`,
  clipPath: `polygon(${poly.map(([x, y]) => `${(x / rw) * 100}% ${(y / rh) * 100}%`).join(',')})`,
});

// Caja del interior cuando la canasta está levantada
function interiorLevantado([x, y, w, h]) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const nw = w * SUBE_ESCALA;
  const nh = h * SUBE_ESCALA;
  return [cx - nw / 2, cy + SUBE_DY - nh / 2, nw, nh];
}

let contador = 0;

/* ============ PAPAS EN VUELO ============ */
function Vuelo({ tipo, desde, hasta, onFin }) {
  const ref = useRef(null);
  const fin = useRef(onFin);
  fin.current = onFin;

  useEffect(() => {
    // La pila sube en arco y baja; siempre conserva su proporción
    const ancho = ((desde[2] + hasta[2]) / 2) * 1.12;
    const medio = [
      (desde[0] + desde[2] / 2 + hasta[0] + hasta[2] / 2) / 2 - ancho / 2,
      (desde[1] + desde[3] / 2 + hasta[1] + hasta[3] / 2) / 2 - 90 - (ancho * PROPORCION) / 2,
      ancho,
      ancho * PROPORCION,
    ];
    const anim = ref.current.animate(
      [
        { ...caja(desde), transform: 'rotate(0deg)', offset: 0 },
        { ...caja(medio), transform: 'rotate(-5deg)', offset: 0.5 },
        { ...caja(hasta), transform: 'rotate(0deg)', offset: 1 },
      ],
      { duration: DURACION_VUELO, easing: 'ease-in-out', fill: 'forwards' }
    );
    anim.finished
      .then(() => {
        if (tipo !== 'cruda') return;
        // Las papas crudas se hunden en el aceite y dejan de verse
        return ref.current.animate(
          [
            { opacity: 1, transform: 'scale(1)' },
            { opacity: 0, transform: 'scale(0.8)' },
          ],
          { duration: 400, easing: 'ease-in', fill: 'forwards' }
        ).finished;
      })
      .then(() => fin.current?.())
      .catch(() => {});
    return () => anim.cancel();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={ref} className={styles.vuelo} style={caja(desde)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={tipo === 'cruda' ? IMG_CRUDAS_PILA : IMG_PORCION} alt="" draggable={false} />
    </div>
  );
}

/**
 * Flujo: tocás las papas de la mesada -> entran a la freidora -> se fríen unos segundos
 * -> la canasta sube -> la tocás y las papas pasan a la bandeja -> tocás la bandeja para entregarlas.
 *
 * Props:
 *  - onListo():    las papas llegaron a la bandeja
 *  - onEntregar(): el jugador retiró las papas de la bandeja
 */
export default function FreidoraStation({ onListo, onEntregar }) {
  // estado de cada canasta: vacio | cargando | friendo | listo
  const [canastas, setCanastas] = useState(CANASTAS.map(() => 'vacio'));
  // bandeja: null | 'vuelo' | 'lista'
  const [bandeja, setBandeja] = useState(null);
  const [vuelos, setVuelos] = useState([]);
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const cambiar = (i, estado) => setCanastas((prev) => prev.map((e, k) => (k === i ? estado : e)));
  const quitarVuelo = (id) => setVuelos((prev) => prev.filter((v) => v.id !== id));

  function tocarPapas() {
    const i = canastas.indexOf('vacio');
    if (i < 0) return;
    cambiar(i, 'cargando');
    const id = ++contador;
    setVuelos((prev) => [
      ...prev,
      {
        id,
        tipo: 'cruda',
        desde: pila(MESADA_PAPAS[0] + MESADA_PAPAS[2] / 2, MESADA_PAPAS[1] + MESADA_PAPAS[3] / 2, 170),
        hasta: pila(
          CANASTAS[i].interior[0] + CANASTAS[i].interior[2] / 2,
          CANASTAS[i].interior[1] + CANASTAS[i].interior[3] / 2,
          CANASTAS[i].interior[2] * 0.95
        ),
        fin: () => {
          quitarVuelo(id);
          cambiar(i, 'friendo');
          timers.current.push(setTimeout(() => cambiar(i, 'listo'), FRY_MS));
        },
      },
    ]);
  }

  function tocarCanasta(i) {
    if (canastas[i] !== 'listo' || bandeja) return;
    const id = ++contador;
    cambiar(i, 'vacio');
    setBandeja('vuelo');
    setVuelos((prev) => [
      ...prev,
      {
        id,
        tipo: 'cocida',
        desde: (() => {
          const [x, y, w, h] = interiorLevantado(CANASTAS[i].interior);
          return pila(x + w / 2, y + h / 2, w);
        })(),
        hasta: BANDEJA_PAPEL,
        fin: () => {
          setBandeja('lista');
          onListo?.();
          // la imagen final aparece encima; el vuelo se retira un instante después
          timers.current.push(setTimeout(() => quitarVuelo(id), 400));
        },
      },
    ]);
  }

  function entregar() {
    setBandeja(null);
    onEntregar?.();
  }

  const hayLibre = canastas.includes('vacio');
  const mensaje =
    bandeja === 'lista' ? '¡Papas listas! Tocá la bandeja para entregarlas'
    : canastas.includes('listo') && !bandeja ? 'Tocá la canasta para pasar las papas a la bandeja'
    : canastas.includes('friendo') ? 'Friendo...'
    : hayLibre ? 'Tocá las papas de la mesada'
    : '';

  return (
    <div
      className={styles.stage}
      style={{ '--img-cocidas': `url(${IMG_COCIDAS})` }}
    >
      <Image src={FONDO} alt="Freidora con dos canastas" fill sizes="100vw" priority draggable={false} />

      {/* Papas crudas de la mesada */}
      <button
        type="button"
        className={styles.mesada}
        style={caja(MESADA_PAPAS)}
        disabled={!hayLibre}
        aria-label="Freír papas"
        onClick={tocarPapas}
      />

      {/* Canastas */}
      {CANASTAS.map((c, i) => {
        const estado = canastas[i];
        if (estado === 'vacio' || estado === 'cargando') return null;
        const listo = estado === 'listo';
        const [rx, ry, rw, rh] = c.region;
        const [ix, iy, iw, ih] = c.interior;
        const origen = `${((ix + iw / 2 - rx) / rw) * 100}% ${((iy + ih / 2 - ry) / rh) * 100}%`;
        return (
          <div key={i}>
            <div
              className={`${styles.canasta} ${listo ? styles.sube : ''}`}
              style={{
                ...caja(c.region),
                transformOrigin: origen,
                '--dy': `${(SUBE_DY / rh) * 100}%`,
                '--escala': SUBE_ESCALA,
              }}
            >
              {listo && <div className={styles.sprite} style={spriteFondo(c.region, c.poly)} />}
              <div className={styles.contenido} style={cajaEn(c.interior, c.region)}>
                {listo ? <div className={styles.cocidas} /> : <div className={styles.burbujas} />}
              </div>
            </div>

            {estado === 'friendo' && (
              <div className={styles.barra} style={caja([ix + iw / 2 - 70, 205, 140, 14])}>
                <span style={{ animationDuration: `${FRY_MS}ms` }} />
              </div>
            )}

            {listo && (
              <button
                type="button"
                className={styles.asa}
                style={caja([ix - 14, iy - 14, iw + 28, ih + 28])}
                disabled={!!bandeja}
                aria-label={`Sacar la canasta ${i + 1}`}
                onClick={() => tocarCanasta(i)}
              />
            )}
          </div>
        );
      })}

      {/* Papas en movimiento */}
      {vuelos.map((v) => (
        <Vuelo key={v.id} tipo={v.tipo} desde={v.desde} hasta={v.hasta} onFin={v.fin} />
      ))}

      {/* Papas sobre la bandeja */}
      {bandeja === 'lista' && (
        <button
          type="button"
          className={styles.porcion}
          style={caja(BANDEJA_PAPEL)}
          aria-label="Entregar papas fritas"
          onClick={entregar}
        >
          <Image src={IMG_PORCION} alt="Papas fritas" fill sizes="25vw" draggable={false} />
        </button>
      )}

      {mensaje && <div className={styles.mensaje} role="status">{mensaje}</div>}
    </div>
  );
}