'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import styles from './MilkshakeStation.module.css';

const API_URL = 'http://localhost:4000/api';

/* ============ CONFIGURACIÓN ============
   Todo en % del escenario (la imagen de la máquina, 1674 x 940).

   Los SABORES ahora vienen del back (GET /api/maquina-milkshake), armados con la
   tabla Ingredientes (nombre e imagen del milkshake terminado, columna "tipo") y
   la tabla SaboresMilkshake (ver milkshakes.sql). Cada sabor trae:
     id     = el mismo id que guarda /partidas (vainilla, chocolate, cookies-cream, frutilla)
     nombre, emoji, color (del líquido), puntos (color de los puntitos, o null)
     x      = posición izquierda del vaso bajo el dispensador
     boton  = zona tocable del dispensador [left, ancho]
     imagen = imagen del milkshake terminado
   Lo que sigue en el front: las medidas de la máquina y de los vasos de vidrio. */

const Y_MAQUINA = 47.0;                 // top del vaso vacío en la máquina
const ANCHO_VASO = 7.5;                 // ancho del vaso vacío
const ALTO_VASO = 31.4;                 // alto del vaso vacío
const VASOS = [14.6, 22.4, 30.3, 38.4].map((left) => ({ left, top: 53.7 }));
const PUNTOS = [[25,70],[50,110],[80,80],[40,150],[70,140],[60,50],[35,100],[90,120]];

// Tamaño del milkshake terminado (podés agrandarlo o achicarlo con ANCHO_FINAL)
const ANCHO_FINAL = 11;                               // % del ancho del escenario
const ALTO_FINAL = ANCHO_FINAL * (1199 / 600) * (1674 / 940); // % del alto del escenario
const BASE_FINAL = 0.985;                               // dónde termina la base del vaso en el PNG

// Lee de la partida guardada qué milkshakes pide el pedido y cuántos ya están listos
function leerPedido() {
  try {
    const partida = JSON.parse(sessionStorage.getItem('partida') || 'null');
    return {
      sabores: Array.isArray(partida?.saboresMilkshake) ? partida.saboresMilkshake : [],
      listos: partida?.milkshakesListos ?? 0,
    };
  } catch (e) {
    return { sabores: [], listos: 0 };
  }
}

// Guarda en la partida cuántos milkshakes ya se entregaron
function guardarProgreso(listos, completo) {
  try {
    const partida = JSON.parse(sessionStorage.getItem('partida') || 'null') ?? {};
    partida.milkshakesListos = listos;
    if (completo) partida.milkshakesCompletos = true;
    sessionStorage.setItem('partida', JSON.stringify(partida));
  } catch (e) {}
}

/* Cada vaso maneja su propia animación, así pueden convivir varios a la vez.
   Fases: viajando -> llenando -> listo
   "s" es el sabor completo que vino del back. */
function Vaso({ id, s, slot, fase, onFase }) {
  const reactId = useId().replace(/:/g, '');
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    const origen = VASOS[slot];
    const destino = s;
    const timers = [];
    let cancelado = false;

    // Se levanta, se desliza hasta el dispensador elegido y baja
    const anim = ref.current.animate(
      [
        { left: `${origen.left}%`, top: `${origen.top}%`, offset: 0 },
        { left: `${origen.left}%`, top: `${origen.top - 9}%`, offset: 0.2 },
        { left: `${destino.x}%`, top: `${Y_MAQUINA - 9}%`, offset: 0.8 },
        { left: `${destino.x}%`, top: `${Y_MAQUINA}%`, offset: 1 },
      ],
      { duration: 900, easing: 'ease-in-out', fill: 'forwards' }
    );

    anim.finished
      .then(() => {
        if (cancelado) return;
        onFase(id, 'llenando');
        timers.push(setTimeout(() => onFase(id, 'listo'), 2100));
      })
      .catch(() => {});

    return () => {
      cancelado = true;
      anim.cancel();
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clase = [styles.vaso, fase !== 'viajando' && styles.lleno, fase === 'listo' && styles.oculto]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={ref} className={clase} style={{ left: `${VASOS[slot].left}%`, top: `${VASOS[slot].top}%` }}>
      <svg viewBox="0 0 125 295" aria-hidden="true">
        <defs>
          <clipPath id={reactId}>
            <path d="M10 8 L115 8 C115 90 98 148 70 188 L55 188 C27 148 10 90 10 8 Z" />
          </clipPath>
        </defs>
        <g clipPath={`url(#${reactId})`}>
          <g className={styles.liquido}>
            <rect x="0" y="40" width="125" height="160" fill={s.color} />
            {s.puntos && PUNTOS.map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r="3" fill={s.puntos} />)}
          </g>
        </g>
        <path
          d="M6 4 L119 4 C119 90 100 150 72 190 L72 235 C95 245 118 262 120 288 L5 288 C7 262 30 245 53 235 L53 190 C25 150 6 90 6 4 Z"
          fill="rgba(220,235,245,.18)" stroke="#c9d3da" strokeWidth="4" strokeLinejoin="round"
        />
        <path d="M20 20 C22 80 34 120 48 150" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="4" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/**
 * Flujo: tocás un vaso -> tocás el sabor en la máquina -> el vaso viaja, se llena
 * y se transforma en el milkshake terminado.
 *
 * Se pueden servir varios vasos al mismo tiempo (uno por dispensador y uno por
 * vaso de vidrio). Cada uno avanza por su cuenta y se entrega tocándolo.
 *
 * El ticket de la esquina muestra los sabores del pedido (los lee de la partida
 * guardada) y va tachando los que ya entregaste. Se piden en orden: si tocás un
 * sabor que no es el que toca, aparece un popup avisando que está mal, NO se
 * llena el vaso y se suelta la selección. Cuando se entrega el último, se guarda
 * el progreso y se vuelve a la cocina principal (/partidas).
 *
 * Props:
 *  - onListo(sabor):    cuando un milkshake terminó de servirse
 *  - onEntregar(sabor): cuando el jugador toca un milkshake terminado (se retira de la máquina)
 */
export default function MilkshakeStation({ onListo, onEntregar }) {
  const router = useRouter();

  // Sabores que vienen del back: [{ id, nombre, emoji, imagen, color, puntos, x, boton }]
  const [catalogo, setCatalogo] = useState(null);
  const [errorDatos, setErrorDatos] = useState('');

  const [seleccionado, setSeleccionado] = useState(null); // índice del vaso elegido
  const [trabajos, setTrabajos] = useState([]);           // [{ id, slot, sabor (id), fase }]
  const [pedido, setPedido] = useState({ sabores: [], listos: 0 });
  const [error, setError] = useState(null);               // { elegido, esperado } mientras se muestra el popup
  const siguienteId = useRef(0);
  const trabajosRef = useRef([]);
  trabajosRef.current = trabajos;

  const saborDe = (id) => catalogo?.find((s) => s.id === id);

  // Pedir al back los sabores de la máquina
  useEffect(() => {
    let cancelado = false;

    const cargarSabores = async () => {
      try {
        const res = await fetch(`${API_URL}/maquina-milkshake`);
        if (!res.ok) throw new Error('No se pudieron obtener los sabores.');
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error('La respuesta del servidor no es válida.');
        if (!cancelado) setCatalogo(data);
      } catch (e) {
        console.error('Error al conectar con el backend:', e);
        if (!cancelado) {
          setErrorDatos(
            'No se pudo conectar con el servidor. Comprobá que el backend esté funcionando.'
          );
        }
      }
    };

    cargarSabores();
    return () => {
      cancelado = true;
    };
  }, []);

  // sessionStorage solo existe en el navegador, por eso se lee después de montar
  // (y cuando ya llegaron los sabores, para quedarse solo con los que existen)
  useEffect(() => {
    if (!catalogo) return;
    const p = leerPedido();
    setPedido({
      sabores: p.sabores.filter((id) => catalogo.some((s) => s.id === id)),
      listos: p.listos,
    });
  }, [catalogo]);

  const slotOcupado = (i) => trabajos.some((t) => t.slot === i);
  const saborOcupado = (clave) => trabajos.some((t) => t.sabor === clave);

  function cambiarFase(id, fase) {
    setTrabajos((ts) => ts.map((t) => (t.id === id ? { ...t, fase } : t)));
    if (fase === 'listo') {
      const t = trabajosRef.current.find((x) => x.id === id);
      if (t) onListo?.(t.sabor);
    }
  }

  function tocarVaso(i) {
    if (error || slotOcupado(i)) return;
    setSeleccionado((actual) => (actual === i ? null : i)); // tocar de nuevo lo suelta
  }

  function tocarSabor(clave) {
    if (error || seleccionado === null || saborOcupado(clave)) return;

    // El pedido se prepara en orden: el siguiente es el que no está entregado ni en curso
    const esperado = pedido.sabores[pedido.listos + trabajos.length];

    if (esperado && clave !== esperado) {
      // Sabor equivocado: popup, no se rellena y se suelta el vaso
      setError({ elegido: clave, esperado });
      setSeleccionado(null);
      return;
    }

    setTrabajos((ts) => [
      ...ts,
      { id: siguienteId.current++, slot: seleccionado, sabor: clave, fase: 'viajando' },
    ]);
    setSeleccionado(null);
  }

  function cerrarError() {
    setError(null);
  }

  function retirar(id) {
    const job = trabajos.find((t) => t.id === id);
    if (!job) return;

    onEntregar?.(job.sabor);

    const total = pedido.sabores.length;
    const nuevosListos = Math.min(total, pedido.listos + 1);
    const completo = total > 0 && nuevosListos >= total;

    // Se guarda después de onEntregar para que este valor sea el que quede
    guardarProgreso(nuevosListos, completo);

    // El ticket tacha el milkshake que se acaba de entregar
    setPedido((p) => ({ ...p, listos: nuevosListos }));
    setTrabajos((ts) => ts.filter((t) => t.id !== id));

    // Último milkshake del ticket: vuelve a la cocina principal
    if (completo) router.push('/partidas');
  }

  /* ---------- PANTALLAS DE ERROR / CARGA (después de todos los hooks) ---------- */
  if (errorDatos) {
    return (
      <div className={styles.stage}>
        <div className={styles.mensaje} role="alert">{errorDatos}</div>
      </div>
    );
  }

  if (!catalogo) {
    return (
      <div className={styles.stage}>
        <div className={styles.mensaje} role="status">Preparando la máquina...</div>
      </div>
    );
  }

  const sirviendo = trabajos.filter((t) => t.fase !== 'listo');
  const hayListos = trabajos.some((t) => t.fase === 'listo');

  const mensaje =
    seleccionado !== null ? 'Ahora elegí un sabor'
    : hayListos ? '¡Listo! Tocá el milkshake para entregarlo'
    : sirviendo.length ? `Sirviendo ${sirviendo.map((t) => saborDe(t.sabor)?.nombre).join(' y ')}...`
    : 'Tocá un vaso de vidrio';

  const terminados = trabajos.filter((t) => t.fase === 'listo');

  return (
    <div className={styles.stage}>
      <Image src="/MaquinaMilkshakes.png" alt="Máquina de milkshakes" fill sizes="100vw" priority draggable={false} />

      {/* Ticket con los sabores que hay que preparar */}
      {pedido.sabores.length > 0 && (
        <aside className={styles.ticket} aria-label="Milkshakes del pedido">
          <h2 className={styles.ticketTitulo}>PEDIDO</h2>
          <ul className={styles.ticketLista}>
            {pedido.sabores.map((clave, i) => {
              const s = saborDe(clave);
              const hecho = i < pedido.listos;
              const enCurso = i >= pedido.listos && i < pedido.listos + trabajos.length;
              const siguiente = i === pedido.listos + trabajos.length;
              return (
                <li
                  key={i}
                  className={[
                    styles.ticketItem,
                    hecho && styles.ticketHecho,
                    enCurso && styles.ticketEnCurso,
                    siguiente && styles.ticketSiguiente,
                  ].filter(Boolean).join(' ')}
                >
                  <span className={styles.ticketEmoji} aria-hidden="true">{s.emoji}</span>
                  <span className={styles.ticketNombre}>Milkshake de {s.nombre}</span>
                  <span className={styles.ticketMarca}>{hecho ? '✓' : enCurso ? '…' : ''}</span>
                </li>
              );
            })}
          </ul>
        </aside>
      )}

      {/* Vasos de vidrio */}
      {VASOS.map((v, i) => (
        <button
          key={i}
          type="button"
          className={`${styles.slot} ${seleccionado === i ? styles.elegido : ''}`}
          style={{ left: `${v.left}%` }}
          disabled={!!error || slotOcupado(i)}
          aria-label={`Tomar vaso ${i + 1}`}
          aria-pressed={seleccionado === i}
          onClick={() => tocarVaso(i)}
        />
      ))}

      {/* Dispensadores (se activan cuando hay un vaso elegido y el dispensador está libre) */}
      {catalogo.map((s) => {
        const libre = seleccionado !== null && !saborOcupado(s.id);
        return (
          <button
            key={s.id}
            type="button"
            className={`${styles.sabor} ${libre ? styles.activo : ''}`}
            style={{ left: `${s.boton[0]}%`, width: `${s.boton[1]}%` }}
            disabled={!libre || !!error}
            aria-label={`Servir ${s.nombre}`}
            onClick={() => tocarSabor(s.id)}
          />
        );
      })}

      {/* Vasos viajando y llenándose */}
      {trabajos.map((t) => {
        const s = saborDe(t.sabor);
        return s ? (
          <Vaso key={t.id} id={t.id} s={s} slot={t.slot} fase={t.fase} onFase={cambiarFase} />
        ) : null;
      })}

      {/* Milkshakes terminados */}
      {terminados.map((t) => {
        const f = saborDe(t.sabor);
        if (!f) return null;
        return (
          <button
            key={t.id}
            type="button"
            className={styles.final}
            aria-label={`Entregar milkshake de ${f.nombre}`}
            onClick={() => retirar(t.id)}
            style={{
              left: `${f.x + ANCHO_VASO / 2 - ANCHO_FINAL / 2}%`,
              top: `${Y_MAQUINA + ALTO_VASO - ALTO_FINAL * BASE_FINAL}%`,
              width: `${ANCHO_FINAL}%`,
            }}
          >
            <Image src={f.imagen} alt={`Milkshake de ${f.nombre}`} width={600} height={1199} draggable={false} />
          </button>
        );
      })}

      <div className={styles.mensaje} role="status">{mensaje}</div>

      {/* Popup de sabor equivocado */}
      {error && (
        <div className={styles.popupFondo} onClick={cerrarError}>
          <div
            className={styles.popup}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="popup-titulo"
            aria-describedby="popup-texto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.popupEmoji} aria-hidden="true">{saborDe(error.elegido)?.emoji} ❌</div>
            <h3 id="popup-titulo" className={styles.popupTitulo}>¡Sabor equivocado!</h3>
            <p id="popup-texto" className={styles.popupTexto}>
              Elegiste <strong>{saborDe(error.elegido)?.nombre}</strong>, pero el pedido pide{' '}
              <strong>{saborDe(error.esperado)?.emoji} {saborDe(error.esperado)?.nombre}</strong>.
              <br />
              Volvé a tocar el vaso y llevalo al sabor correcto.
            </p>
            <button type="button" className={styles.popupBoton} onClick={cerrarError} autoFocus>
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}