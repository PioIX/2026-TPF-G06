'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import styles from './FreidoraStation.module.css';

const API_URL = 'http://localhost:4000/api';

/* ============ CONFIGURACIÓN ============
   Todas las medidas están en píxeles de la imagen Freidora.png (1671 x 941).
   Cada caja es [x, y, ancho, alto]. El componente las convierte a % solo.

   PASO 1 (viene del back, ver los endpoints de index.js):
     - GET /api/config-juego -> tamaños de papas (ids y nombres) y tiempo de fritura
     - GET /api/fritos       -> imagen de la pila de papas (columna "tipo" de Ingredientes)
   Lo que sigue en el front por ahora: las posiciones y medidas dibujadas sobre Freidora.png. */
const W = 1671;
const H = 941;
const FONDO = '/Freidora.png';                      // ya SIN la bandeja de la derecha
const IMG_COCIDAS = '/papas-fritas-nucleo.png';     // relleno de la canasta al terminar
const IMG_CARTON_VACIO = '/cartonPapas.png';
const IMG_CARTON_LLENO = '/papas.png';

const VOLVER_A = '/partidas';

// Las pilas mantienen siempre su proporción (alto = ancho x proporción)
const PROPORCION = 0.698;               // alto / ancho de papasRicas.png (recortada)
const PROPORCION_FRITA = PROPORCION;
const pila = (cx, cy, ancho, prop = PROPORCION) => [cx - ancho / 2, cy - (ancho * prop) / 2, ancho, ancho * prop];

const DURACION_VUELO = 1200;              // cuánto tardan las papas en viajar (ms)
const MESADA_PAPAS = [12, 205, 210, 210]; // papas crudas de la mesada (zona tocable)

/* ---- Tres cartones vacíos en columna (donde estaba la bandeja), uno por tamaño ----
   cx = centro horizontal de la columna, w = ancho, base = borde inferior de cada cartón.
   Las claves son los ids de los tamaños que manda el back (pequeno, mediano, grande). */
const COLUMNA_CX = 1450;
const CARTONES = {
  pequeno: { w: 125, base: 355 },
  mediano: { w: 156, base: 506 },
  grande:  { w: 188, base: 684 },
};

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

// Ticket (arriba, sobre la mesada de la derecha). Más alto para que entren varios pedidos.
const TICKET = [1205, 12, 300, 185];

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

// Lee la partida que guardó /partidas al salir hacia la freidora
function leerPartida() {
  try {
    const texto = sessionStorage.getItem('partida');
    return texto ? JSON.parse(texto) : null;
  } catch (e) {
    return null;
  }
}

let contador = 0;

/* ============ PAPAS EN VUELO ============ */
function Vuelo({ tipo, imagen, desde, hasta, onLlego, onFin }) {
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
        src={imagen}
        alt=""
        draggable={false}
        style={{ objectFit: 'contain', borderRadius: 0 }}
      />
    </div>
  );
}

/**
 * Flujo (se repite una vez por cada pedido de papas del ticket):
 * tocás las papas de la mesada -> viajan a la freidora y se fríen unos segundos
 * -> la canasta sube -> elegís el tamaño del cartón (según el ticket) -> tocás la canasta
 * y las papas viajan al cartón -> tocás el paquete de papas para entregarlo.
 * Cuando entregaste todos los pedidos del ticket vuelve a /partidas.
 *
 * Los pedidos salen de la partida guardada por /partidas (fritosPedidos, tamanosFritos
 * y fritosListos). Al volver, el componente deja actualizado fritosListos y
 * resultadoFreidora = 'cocinada' en esa partida.
 *
 * Props (todas opcionales; solo se usan si no hay partida guardada):
 *  - pedidos:       ['pequeno' | 'mediano' | 'grande', ...]  (un tamaño por pedido)
 *  - pedido:        { tamano, numero? }  (un solo pedido, formato anterior)
 *  - onListo():     las papas llegaron al cartón
 *  - onEntregar({ tamano, pedido, correcto, entregados, total }): cada vez que se entrega un paquete
 *  - volverA:       ruta de regreso (por defecto '/partidas')
 */
export default function FreidoraStation({ pedido, pedidos: pedidosProp, onListo, onEntregar, volverA = VOLVER_A }) {
  const router = useRouter();

  // PASO 1: datos que vienen del back
  // { tamanos: [{ id, nombre }], fryMs, imagenPila }
  const [datos, setDatos] = useState(null);
  const [errorDatos, setErrorDatos] = useState('');

  // estado de cada canasta: vacio | cargando | friendo | listo
  const [canastas, setCanastas] = useState(CANASTAS.map(() => 'vacio'));
  const [vuelos, setVuelos] = useState([]);
  const [tamano, setTamano] = useState(null);       // tamaño elegido por el jugador
  const [fase, setFase] = useState('cocina');       // cocina | llenando | lleno
  const [aviso, setAviso] = useState('');
  const [pedidos, setPedidos] = useState([]);       // [{ tamano, hecho }]
  const timers = useRef([]);
  const yaTermino = useRef(false);
  const entregados = useRef(0);

  const nombreTamano = (t) => datos?.tamanos.find((x) => x.id === t)?.nombre ?? t;

  // Pedir al back los tamaños, el tiempo de fritura y la imagen de las papas
  useEffect(() => {
    let cancelado = false;

    const cargarDatos = async () => {
      try {
        const [resConfig, resFritos] = await Promise.all([
          fetch(`${API_URL}/config-juego`),
          fetch(`${API_URL}/fritos`),
        ]);
        if (!resConfig.ok || !resFritos.ok) {
          throw new Error('No se pudieron obtener los datos.');
        }

        const config = await resConfig.json();
        const fritos = await resFritos.json();
        if (!Array.isArray(config?.tamanosFritos) || !Array.isArray(fritos)) {
          throw new Error('La respuesta del servidor no es válida.');
        }

        if (cancelado) return;
        setDatos({
          // solo los tamaños que tienen su cartón dibujado en la imagen
          tamanos: config.tamanosFritos.filter((t) => CARTONES[t.id]),
          fryMs: Number(config.tiempoFrituraMs) || 5000,
          imagenPila: fritos[0]?.imagen ?? '',
        });
      } catch (e) {
        console.error('Error al conectar con el backend:', e);
        if (!cancelado) {
          setErrorDatos(
            'No se pudo conectar con el servidor. Comprobá que el backend esté funcionando.'
          );
        }
      }
    };

    cargarDatos();
    return () => {
      cancelado = true;
    };
  }, []);

  // Los pedidos se arman en el cliente (usa sessionStorage y azar), para no romper la hidratación.
  // Se arman cuando ya llegaron los tamaños del back.
  useEffect(() => {
    if (!datos) return;

    const ids = datos.tamanos.map((t) => t.id);
    const tamanoAlAzar = () => ids[Math.floor(Math.random() * ids.length)];

    let lista = null;

    const partida = leerPartida();
    if (partida && Array.isArray(partida.fritosPedidos)) {
      const hechos = partida.fritosListos ?? 0;
      const quedan = Math.max(0, partida.fritosPedidos.length - hechos);
      const tamanos = Array.isArray(partida.tamanosFritos) ? partida.tamanosFritos.slice(hechos) : [];
      lista = Array.from({ length: quedan }, (_, i) =>
        ids.includes(tamanos[i]) ? tamanos[i] : tamanoAlAzar()
      );
    }

    if (!lista || lista.length === 0) {
      if (Array.isArray(pedidosProp) && pedidosProp.length > 0) lista = pedidosProp;
      else if (pedido?.tamano) lista = [pedido.tamano];
      else lista = [tamanoAlAzar()];
    }

    setPedidos(lista.map((t) => ({ tamano: t, hecho: false })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const cambiar = (i, estado) => setCanastas((prev) => prev.map((e, k) => (k === i ? estado : e)));
  const quitarVuelo = (id) => setVuelos((prev) => prev.filter((v) => v.id !== id));

  const mostrarAviso = (texto) => {
    setAviso(texto);
    timers.current.push(setTimeout(() => setAviso(''), 1800));
  };

  // Cuántos pedidos faltan entregar y cuántos ya están en camino (friendo, listos o en un cartón)
  const pendientes = pedidos.filter((p) => !p.hecho).length;
  const enProceso = canastas.filter((e) => e !== 'vacio').length + (fase !== 'cocina' ? 1 : 0);

  const hayLibre = canastas.includes('vacio');
  const hayListo = canastas.includes('listo');
  const puedeFreir = hayLibre && fase === 'cocina' && enProceso < pendientes;

  function tocarPapas() {
    const i = canastas.indexOf('vacio');
    if (i < 0 || !puedeFreir) return;
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
          timers.current.push(setTimeout(() => cambiar(i, 'listo'), datos.fryMs));
        },
      },
    ]);
  }

  // Elegir el tamaño del cartón: tiene que ser uno que el ticket todavía pide
  function elegirTamano(t) {
    if (!pedidos.some((p) => !p.hecho && p.tamano === t)) {
      mostrarAviso('El ticket no pide ese tamaño');
      return;
    }
    setTamano(t);
  }

  function tocarCanasta(i) {
    if (canastas[i] !== 'listo' || fase !== 'cocina') return;
    if (!tamano) {
      // todavía no eligió el tamaño del cartón
      mostrarAviso('Primero elegí el tamaño del cartón');
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
        // las papas aterrizan: aparece el cartón lleno y hay que tocarlo para entregarlo
        llego: () => {
          setFase('lleno');
          onListo?.();
        },
        fin: () => quitarVuelo(id),
      },
    ]);
  }

  // Tocar el paquete de papas: se entrega ese pedido
  function entregar() {
    if (fase !== 'lleno' || yaTermino.current) return;

    let idx = pedidos.findIndex((p) => !p.hecho && p.tamano === tamano);
    if (idx < 0) idx = pedidos.findIndex((p) => !p.hecho);

    const nuevos = pedidos.map((p, k) => (k === idx ? { ...p, hecho: true } : p));
    entregados.current += 1;
    onEntregar?.({
      tamano,
      pedido: pedidos[idx]?.tamano ?? tamano,
      correcto: pedidos[idx]?.tamano === tamano,
      entregados: entregados.current,
      total: pedidos.length,
    });
    setPedidos(nuevos);

    if (nuevos.every((p) => p.hecho)) {
      // era el último pedido: se guarda el avance y se vuelve a /partidas
      yaTermino.current = true;
      const partida = leerPartida();
      if (partida) {
        const total = Array.isArray(partida.fritosPedidos) ? partida.fritosPedidos.length : Infinity;
        partida.fritosListos = Math.min(total, (partida.fritosListos ?? 0) + entregados.current);
        partida.resultadoFreidora = 'cocinada';
        try {
          sessionStorage.setItem('partida', JSON.stringify(partida));
        } catch (e) {
          /* si no se puede guardar, igual se vuelve */
        }
      }
      router.push(volverA);
    } else {
      // todavía faltan pedidos: se despeja el cartón para armar el siguiente
      setTamano(null);
      setFase('cocina');
    }
  }

  /* ---------- PANTALLAS DE ERROR / CARGA (después de todos los hooks) ---------- */
  if (errorDatos) {
    return (
      <div className={styles.stage}>
        <div className={styles.mensaje} role="alert">{errorDatos}</div>
      </div>
    );
  }

  if (!datos) {
    return (
      <div className={styles.stage}>
        <div className={styles.mensaje} role="status">Preparando la freidora...</div>
      </div>
    );
  }

  const mensaje =
    fase === 'lleno'
      ? pendientes > 1
        ? `¡Papas listas! Tocá el paquete para entregarlo (te faltan ${pendientes - 1} más)`
        : '¡Papas listas! Tocá el paquete de papas para entregarlo'
    : fase === 'llenando' ? ''
    : aviso ? aviso
    : hayListo && !tamano ? 'Elegí el tamaño del cartón según el ticket'
    : hayListo ? 'Tocá la canasta para llenar el cartón'
    : canastas.includes('friendo') ? 'Friendo...'
    : puedeFreir ? 'Tocá las papas de la mesada'
    : '';

  return (
    <div
      className={styles.stage}
      style={{ '--img-cocidas': `url(${IMG_COCIDAS})` }}
    >
      <Image src={FONDO} alt="Freidora con dos canastas" fill sizes="100vw" priority draggable={false} />

      {/* Ticket del pedido: siempre visible, con todos los pedidos de papas */}
      {pedidos.length > 0 && (
        <div className={styles.ticket} style={caja(TICKET)} aria-label="Pedido de papas fritas">
          <div className={styles.ticketTitulo}>
            PEDIDO{pedido?.numero ? ` #${pedido.numero}` : ''}
          </div>
          <ul className={styles.ticketLista}>
            {pedidos.map((p, i) => (
              <li
                key={i}
                className={`${styles.ticketFila} ${p.hecho ? styles.ticketHecho : ''}`}
              >
                <span>Papas fritas</span>
                <strong>{nombreTamano(p.tamano)}</strong>
                <span className={styles.ticketMarca}>{p.hecho ? '✓' : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Papas crudas de la mesada */}
      <button
        type="button"
        className={styles.mesada}
        style={caja(MESADA_PAPAS)}
        disabled={!puedeFreir}
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
                <span style={{ animationDuration: `${datos.fryMs}ms` }} />
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
      {datos.tamanos.map(({ id: t }) => {
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
                aria-label={`Cartón ${nombreTamano(t)}`}
                aria-pressed={elegido}
                onClick={() => elegirTamano(t)}
              >
                <Image src={IMG_CARTON_VACIO} alt="" fill sizes="15vw" draggable={false} />
              </button>
            )}
            {lleno && (
              <button
                type="button"
                className={styles.cartonLleno}
                style={caja(cartonLlenoCaja(t))}
                aria-label="Entregar las papas fritas"
                onClick={entregar}
              >
                <Image src={IMG_CARTON_LLENO} alt="Papas fritas en su cartón" fill sizes="15vw" draggable={false} />
              </button>
            )}
            <div
              className={`${styles.etiqueta} ${elegido ? styles.etiquetaSel : ''} ${apagado ? styles.cartonApagado : ''}`}
              style={caja([1225, y + h / 2 - 15, 100, 30])}
            >
              {nombreTamano(t)}
            </div>
          </div>
        );
      })}

      {/* Papas en movimiento */}
      {vuelos.map((v) => (
        <Vuelo
          key={v.id}
          tipo={v.tipo}
          imagen={datos.imagenPila}
          desde={v.desde}
          hasta={v.hasta}
          onLlego={v.llego}
          onFin={v.fin}
        />
      ))}

      {mensaje && <div className={styles.mensaje} role="status">{mensaje}</div>}
    </div>
  );
}