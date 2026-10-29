'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import styles from './FreidoraStation.module.css';

/* ============ CONFIGURACIÓN ============
   Todas las medidas están en píxeles de la imagen Freidora.png (1671 x 941).
   Cada caja es [x, y, ancho, alto]. El componente las convierte a % solo. */
const W = 1671;
const H = 941;
const FONDO = '/Freidora.png';                      // ya SIN la bandeja de la derecha
const IMG_PILA = '/papasRicas.png';                 // pila que viaja a la freidora (y después de la canasta al cartón)
const IMG_COCIDAS = '/papas-fritas-nucleo.png';     // relleno de la canasta al terminar
const IMG_CARTON_VACIO = '/cartonPapas.png';
const IMG_CARTON_LLENO = '/papas.png';

const VOLVER_A = '/partidas';
const ESPERA_FINAL_MS = 2500;   // cuánto se queda viendo el cartón armado antes de volver

// Las pilas mantienen siempre su proporción (alto = ancho x proporción)
const PROPORCION = 0.698;               // alto / ancho de papasRicas.png (recortada)
const PROPORCION_FRITA = PROPORCION;
const pila = (cx, cy, ancho, prop = PROPORCION) => [cx - ancho / 2, cy - (ancho * prop) / 2, ancho, ancho * prop];

const FRY_MS = 5000;                      // tiempo en la freidora
const DURACION_VUELO = 1200;              // cuánto tardan las papas en viajar (ms)
const MESADA_PAPAS = [12, 205, 210, 210]; // papas crudas de la mesada (zona tocable)

/* ---- Tres cartones vacíos en columna (donde estaba la bandeja), uno por tamaño ----
   cx = centro horizontal de la columna, w = ancho, base = borde inferior de cada cartón. */
const COLUMNA_CX = 1450;
const CARTONES = {
  pequeno: { w: 125, base: 355 },
  mediano: { w: 156, base: 506 },
  grande:  { w: 188, base: 684 },
};
const NOMBRES = { pequeno: 'Pequeño', mediano: 'Mediano', grande: 'Grande' };
const TAMANOS = ['pequeno', 'mediano', 'grande'];

const cartonVacioCaja = (t) => {
  const { w, base } = CARTONES[t];
  const h = w * 0.875;
  return [COLUMNA_CX - w / 2, base - h, w, h];
};
// el cartón lleno trae las papas sobresaliendo, por eso es más alto (el cuerpo coincide con el vacío)
const cartonLlenoCaja = (t) => {
  const { w, base } = CARTONES[t];
  const w2 = w * 1.063;
  const h2 = w * 1.238;
  return [COLUMNA_CX - w2 / 2, base - h2, w2, h2];
};
// donde aterrizan las papas: la boca del cartón
const bocaCarton = (t) => {
  const [x, y, w, h] = cartonVacioCaja(t);
  return pila(x + w / 2, y + h * 0.45, w * 0.8, PROPORCION_FRITA);
};

// Ticket (arriba, sobre la mesada de la derecha)
const TICKET = [1205, 12, 300, 165];

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
function Vuelo({ tipo, desde, hasta, onLlego, onFin }) {
  const ref = useRef(null);
  const llego = useRef(onLlego);
  const fin = useRef(onFin);
  llego.current = onLlego;
  fin.current = onFin;

  useEffect(() => {
    // La pila sube en arco y baja; siempre conserva su proporción
    const prop = desde[3] / desde[2];
    const ancho = ((desde[2] + hasta[2]) / 2) * 1.12;
    const medio = [
      (desde[0] + desde[2] / 2 + hasta[0] + hasta[2] / 2) / 2 - ancho / 2,
      (desde[1] + desde[3] / 2 + hasta[1] + hasta[3] / 2) / 2 - 90 - (ancho * prop) / 2,
      ancho,
      ancho * prop,
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
        llego.current?.();
        // crudas: se hunden en el aceite. cocidas: se funden con el cartón que aparece.
        const keyframes =
          tipo === 'cruda'
            ? [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.8)' }]
            : [{ opacity: 1 }, { opacity: 0 }];
        return ref.current.animate(keyframes, {
          duration: tipo === 'cruda' ? 400 : 350,
          easing: 'ease-in',
          fill: 'forwards',
        }).finished;
      })
      .then(() => fin.current?.())
      .catch(() => {});
    return () => anim.cancel();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={ref} className={styles.vuelo} style={caja(desde)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={IMG_PILA}
        alt=""
        draggable={false}
        style={{ objectFit: 'contain', borderRadius: 0 }}
      />
    </div>
  );
}

/**
 * Flujo: tocás las papas de la mesada -> viajan a la freidora y se fríen unos segundos
 * -> la canasta sube -> elegís el tamaño del cartón (según el ticket) -> tocás la canasta
 * y las papas viajan al cartón -> se ve el cartón armado unos segundos -> vuelve a /partidas.
 *
 * Props:
 *  - pedido:        { tamano: 'pequeno' | 'mediano' | 'grande', numero?: number }  (lo que pide el ticket)
 *  - onListo():     las papas llegaron al cartón
 *  - onEntregar({ tamano, pedido, correcto }): justo antes de volver a /partidas
 *  - volverA:       ruta de regreso (por defecto '/partidas')
 */
export default function FreidoraStation({ pedido, onListo, onEntregar, volverA = VOLVER_A }) {
  const router = useRouter();

  // estado de cada canasta: vacio | cargando | friendo | listo
  const [canastas, setCanastas] = useState(CANASTAS.map(() => 'vacio'));
  const [vuelos, setVuelos] = useState([]);
  const [tamano, setTamano] = useState(null);       // tamaño elegido por el jugador
  const [fase, setFase] = useState('cocina');       // cocina | llenando | lleno
  const [aviso, setAviso] = useState(false);
  const [pedidoTam, setPedidoTam] = useState(pedido?.tamano ?? null);
  const timers = useRef([]);

  // Si no llega un pedido por props, se sortea uno (en el cliente, para no romper la hidratación)
  useEffect(() => {
    if (pedido?.tamano) {
      setPedidoTam(pedido.tamano);
    } else {
      setPedidoTam((prev) => prev ?? TAMANOS[Math.floor(Math.random() * TAMANOS.length)]);
    }
  }, [pedido?.tamano]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const cambiar = (i, estado) => setCanastas((prev) => prev.map((e, k) => (k === i ? estado : e)));
  const quitarVuelo = (id) => setVuelos((prev) => prev.filter((v) => v.id !== id));

  function tocarPapas() {
    const i = canastas.indexOf('vacio');
    if (i < 0 || fase !== 'cocina') return;
    cambiar(i, 'cargando');
    const id = ++contador;
    setVuelos((prev) => [
      ...prev,
      {
        id,
        tipo: 'cruda',
        desde: pila(MESADA_PAPAS[0] + MESADA_PAPAS[2] / 2, MESADA_PAPAS[1] + MESADA_PAPAS[3] / 2, 200),
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
    if (canastas[i] !== 'listo' || fase !== 'cocina') return;
    if (!tamano) {
      // todavía no eligió el tamaño del cartón
      setAviso(true);
      timers.current.push(setTimeout(() => setAviso(false), 1800));
      return;
    }
    const id = ++contador;
    cambiar(i, 'vacio');
    setFase('llenando');
    setVuelos((prev) => [
      ...prev,
      {
        id,
        tipo: 'cocida',
        desde: (() => {
          const [x, y, w, h] = interiorLevantado(CANASTAS[i].interior);
          return pila(x + w / 2, y + h / 2, w * 1.1, PROPORCION_FRITA);
        })(),
        hasta: bocaCarton(tamano),
        // las papas aterrizan: aparece el cartón lleno y empieza la cuenta para volver
        llego: () => {
          setFase('lleno');
          onListo?.();
          timers.current.push(setTimeout(terminar, ESPERA_FINAL_MS));
        },
        fin: () => quitarVuelo(id),
      },
    ]);
  }

  // `tamano` queda fijo una vez que se llena el cartón, por eso se lee desde el ref
  const tamanoRef = useRef(null);
  tamanoRef.current = tamano;

  function terminar() {
    const elegido = tamanoRef.current;
    onEntregar?.({ tamano: elegido, pedido: pedidoTam, correcto: elegido === pedidoTam });
    router.push(volverA);
  }

  const hayLibre = canastas.includes('vacio');
  const hayListo = canastas.includes('listo');

  const mensaje =
    fase === 'lleno' ? '¡Pedido armado!'
    : fase === 'llenando' ? ''
    : aviso ? 'Primero elegí el tamaño del cartón'
    : hayListo && !tamano ? 'Elegí el tamaño del cartón según el ticket'
    : hayListo ? 'Tocá la canasta para llenar el cartón'
    : canastas.includes('friendo') ? 'Friendo...'
    : hayLibre ? 'Tocá las papas de la mesada'
    : '';

  return (
    <div
      className={styles.stage}
      style={{ '--img-cocidas': `url(${IMG_COCIDAS})` }}
    >
      <Image src={FONDO} alt="Freidora con dos canastas" fill sizes="100vw" priority draggable={false} />

      {/* Ticket del pedido: siempre visible */}
      {pedidoTam && (
        <div className={styles.ticket} style={caja(TICKET)} aria-label={`Pedido: papas fritas ${NOMBRES[pedidoTam]}`}>
          <div className={styles.ticketTitulo}>
            PEDIDO{pedido?.numero ? ` #${pedido.numero}` : ''}
          </div>
          <div className={styles.ticketLinea}>
            <span>Papas fritas</span>
          </div>
          <div className={styles.ticketTamano}>{NOMBRES[pedidoTam]}</div>
        </div>
      )}

      {/* Papas crudas de la mesada */}
      <button
        type="button"
        className={styles.mesada}
        style={caja(MESADA_PAPAS)}
        disabled={!hayLibre || fase !== 'cocina'}
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
                disabled={fase !== 'cocina'}
                aria-label={`Sacar la canasta ${i + 1}`}
                onClick={() => tocarCanasta(i)}
              />
            )}
          </div>
        );
      })}

      {/* Los tres cartones vacíos: se elige el tamaño tocando uno */}
      {TAMANOS.map((t) => {
        const elegido = tamano === t;
        const lleno = fase === 'lleno' && elegido;
        const apagado = fase === 'lleno' && !elegido;
        const [x, y, w, h] = cartonVacioCaja(t);
        return (
          <div key={t}>
            {!lleno && (
              <button
                type="button"
                className={`${styles.cartonBtn} ${elegido ? styles.cartonSel : ''} ${
                  hayListo && !tamano && fase === 'cocina' ? styles.cartonLlamado : ''
                } ${apagado ? styles.cartonApagado : ''}`}
                style={caja([x, y, w, h])}
                disabled={!hayListo || fase !== 'cocina'}
                aria-label={`Cartón ${NOMBRES[t]}`}
                aria-pressed={elegido}
                onClick={() => setTamano(t)}
              >
                <Image src={IMG_CARTON_VACIO} alt="" fill sizes="15vw" draggable={false} />
              </button>
            )}
            {lleno && (
              <div className={styles.cartonLleno} style={caja(cartonLlenoCaja(t))}>
                <Image src={IMG_CARTON_LLENO} alt="Papas fritas en su cartón" fill sizes="15vw" draggable={false} />
              </div>
            )}
            <div
              className={`${styles.etiqueta} ${elegido ? styles.etiquetaSel : ''} ${apagado ? styles.cartonApagado : ''}`}
              style={caja([1225, y + h / 2 - 15, 100, 30])}
            >
              {NOMBRES[t]}
            </div>
          </div>
        );
      })}

      {/* Papas en movimiento */}
      {vuelos.map((v) => (
        <Vuelo key={v.id} tipo={v.tipo} desde={v.desde} hasta={v.hasta} onLlego={v.llego} onFin={v.fin} />
      ))}

      {mensaje && <div className={styles.mensaje} role="status">{mensaje}</div>}
    </div>
  );
}