'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

import styles from './MilkshakeStation.module.css';

/* ============ CONFIGURACIÓN ============
   Todo en % del escenario (la imagen de la máquina, 1674 x 940).
   x     = posición izquierda del vaso bajo el dispensador
   boton = zona tocable del dispensador (left, ancho)
   final = imagen del milkshake terminado (poné los PNG en /public/milkshakes/) */
const SABORES = {
  vainilla:  { nombre: 'Vainilla',        emoji: '🍦', color: '#f6e7c1', x: 49.5, boton: [49.6, 7.2], final: '/vainilla.png' },
  chocolate: { nombre: 'Chocolate',       emoji: '🍫', color: '#5a3320', x: 59.3, boton: [59.1, 7.2], final: '/chocolate.png' },
  frutilla:  { nombre: 'Frutilla',        emoji: '🍓', color: '#f4a7b9', x: 69.3, boton: [69.3, 7.2], final: '/frutilla.png' },
  cookies:   { nombre: 'Cookies & Cream', emoji: '🍪', color: '#d9d2cb', x: 79.8, boton: [79.4, 8.1], final: '/cookies&cream.png', puntos: '#3a2a22' },
};

// El juego guarda los sabores con estos ids; acá se traducen a las claves de SABORES
const ALIAS_JUEGO = { 'cookies-cream': 'cookies' };

  vainilla:  { nombre: 'Vainilla',        color: '#f6e7c1', x: 49.5, boton: [49.6, 7.2], final: '/vainilla.png' },
  chocolate: { nombre: 'Chocolate',       color: '#5a3320', x: 59.3, boton: [59.1, 7.2], final: '/chocolate.png' },
  frutilla:  { nombre: 'Frutilla',        color: '#f4a7b9', x: 69.3, boton: [69.3, 7.2], final: '/frutilla.png' },
  cookies:   { nombre: 'Cookies & Cream', color: '#d9d2cb', x: 79.8, boton: [79.4, 8.1], final: '/cookies&cream.png', puntos: '#3a2a22' },
};

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
    const sabores = (partida?.saboresMilkshake ?? [])
      .map((id) => ALIAS_JUEGO[id] ?? id)
      .filter((clave) => SABORES[clave]);
    return { sabores, listos: partida?.milkshakesListos ?? 0 };
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


function Vaso({ sabor, fase, left, top, innerRef }) {
  const id = useId().replace(/:/g, '');
  const s = SABORES[sabor];
  const clase = [styles.vaso, fase !== 'viajando' && styles.lleno, fase === 'listo' && styles.oculto]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={innerRef} className={clase} style={{ left: `${left}%`, top: `${top}%` }}>
      <svg viewBox="0 0 125 295" aria-hidden="true">
        <defs>
          <clipPath id={id}>
            <path d="M10 8 L115 8 C115 90 98 148 70 188 L55 188 C27 148 10 90 10 8 Z" />
          </clipPath>
        </defs>
        <g clipPath={`url(#${id})`}>
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
 * El ticket de la esquina muestra los sabores del pedido (los lee de la partida
 * guardada) y va tachando los que ya entregaste. Se piden en orden: si tocás un
 * sabor que no es el que toca, aparece un popup avisando que está mal, NO se
 * llena el vaso y se suelta la selección: hay que volver a tocar el vaso y
 * llevarlo al sabor correcto. Cuando se entrega el último, se guarda el
 * progreso y se vuelve a la cocina principal (/partidas).
 *

 * Props:
 *  - onListo(sabor):    cuando el milkshake terminó de servirse
 *  - onEntregar(sabor): cuando el jugador toca el milkshake terminado (se retira de la máquina)
 */
export default function MilkshakeStation({ onListo, onEntregar }) {
  const router = useRouter();
  const [seleccionado, setSeleccionado] = useState(null); // índice del vaso elegido
  const [activo, setActivo] = useState(null);             // { slot, sabor }
  const [fase, setFase] = useState('viajando');           // viajando -> llenando -> listo
  const [pedido, setPedido] = useState({ sabores: [], listos: 0 });
  const [error, setError] = useState(null);               // { elegido, esperado } mientras se muestra el popup
  const vasoRef = useRef(null);

  // sessionStorage solo existe en el navegador, por eso se lee después de montar
  useEffect(() => {
    setPedido(leerPedido());
  }, []);


  const [seleccionado, setSeleccionado] = useState(null); // índice del vaso elegido
  const [activo, setActivo] = useState(null);             // { slot, sabor }
  const [fase, setFase] = useState('viajando');           // viajando -> llenando -> listo
  const vasoRef = useRef(null);

  useEffect(() => {
    if (!activo || !vasoRef.current) return;
    const origen = VASOS[activo.slot];
    const destino = SABORES[activo.sabor];
    const timers = [];
    let cancelado = false;

    // Se levanta, se desliza hasta el dispensador elegido y baja
    const anim = vasoRef.current.animate(
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
        setFase('llenando');
        timers.push(setTimeout(() => {
          setFase('listo');
          onListo?.(activo.sabor);
        }, 2100));
      })
      .catch(() => {});

    return () => {
      cancelado = true;
      anim.cancel();
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo]);

  function tocarVaso(i) {
    if (activo || error) return;

    if (activo) return;
setSeleccionado((actual) => (actual === i ? null : i)); // tocar de nuevo lo suelta
  }

  function tocarSabor(clave) {
 rank
    if (activo || error || seleccionado === null) return;

    // El pedido se prepara en orden: el siguiente es el que está sin tachar
    const esperado = pedido.sabores[pedido.listos];

    if (esperado && clave !== esperado) {
      // Sabor equivocado: popup, no se rellena y se suelta el vaso
      setError({ elegido: clave, esperado });
      setSeleccionado(null);
      return;
    }


    if (activo || seleccionado === null) return;
    setFase('viajando');
    setActivo({ slot: seleccionado, sabor: clave });
    setSeleccionado(null);
  }

  function cerrarError() {
    setError(null);
  }

  function retirar() {
    onEntregar?.(activo.sabor);

    const total = pedido.sabores.length;
    const nuevosListos = Math.min(total, pedido.listos + 1);
    const completo = total > 0 && nuevosListos >= total;

    // Se guarda después de onEntregar para que este valor sea el que quede
    guardarProgreso(nuevosListos, completo);

    // El ticket tacha el milkshake que se acaba de entregar
    setPedido((p) => ({ ...p, listos: nuevosListos }));
    setActivo(null);

    // Último milkshake del ticket: vuelve a la cocina principal
    if (completo) router.push('/partidas');

  function retirar() {
    onEntregar?.(activo.sabor);
    setActivo(null);
  }

  const mensaje = activo
    ? fase === 'listo' ? '¡Listo! Tocá el milkshake para entregarlo' : `Sirviendo ${SABORES[activo.sabor].nombre}...`
    : seleccionado !== null ? 'Ahora elegí un sabor' : 'Tocá un vaso de vidrio';

  const final = activo && fase === 'listo' ? SABORES[activo.sabor] : null;

  return (
    <div className={styles.stage}>
      <Image src="/MaquinaMilkshakes.png" alt="Máquina de milkshakes" fill sizes="100vw" priority draggable={false} />

      {/* Ticket con los sabores que hay que preparar */}
      {pedido.sabores.length > 0 && (
        <aside className={styles.ticket} aria-label="Milkshakes del pedido">
          <h2 className={styles.ticketTitulo}>PEDIDO</h2>
          <ul className={styles.ticketLista}>
            {pedido.sabores.map((clave, i) => {
              const s = SABORES[clave];
              const hecho = i < pedido.listos;
              const siguiente = i === pedido.listos;
              return (
                <li
                  key={i}
                  className={[
                    styles.ticketItem,
                    hecho && styles.ticketHecho,
                    siguiente && styles.ticketSiguiente,
                  ].filter(Boolean).join(' ')}
                >
                  <span className={styles.ticketEmoji} aria-hidden="true">{s.emoji}</span>
                  <span className={styles.ticketNombre}>Milkshake de {s.nombre}</span>
                  <span className={styles.ticketMarca}>{hecho ? '✓' : ''}</span>
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
          disabled={!!activo || !!error}

          disabled={!!activo}
          aria-label={`Tomar vaso ${i + 1}`}
          aria-pressed={seleccionado === i}
          onClick={() => tocarVaso(i)}
        />
      ))}

      {/* Dispensadores (se activan cuando hay un vaso elegido) */}
      {Object.entries(SABORES).map(([clave, s]) => (
        <button
          key={clave}
          type="button"
          className={`${styles.sabor} ${seleccionado !== null ? styles.activo : ''}`}
          style={{ left: `${s.boton[0]}%`, width: `${s.boton[1]}%` }}
          disabled={seleccionado === null || !!activo || !!error}

          disabled={seleccionado === null || !!activo}
          aria-label={`Servir ${s.nombre}`}
          onClick={() => tocarSabor(clave)}
        />
      ))}

      {/* Vaso viajando y llenándose */}
      {activo && (
        <Vaso
          innerRef={vasoRef}
          sabor={activo.sabor}
          fase={fase}
          left={VASOS[activo.slot].left}
          top={VASOS[activo.slot].top}
        />
      )}

      {/* Milkshake terminado */}
      {final && (
        <button
          type="button"
          className={styles.final}
          aria-label={`Entregar milkshake de ${final.nombre}`}
          onClick={retirar}
          style={{
            left: `${final.x + ANCHO_VASO / 2 - ANCHO_FINAL / 2}%`,
            top: `${Y_MAQUINA + ALTO_VASO - ALTO_FINAL * BASE_FINAL}%`,
            width: `${ANCHO_FINAL}%`,
          }}
        >
          <Image src={final.final} alt={`Milkshake de ${final.nombre}`} width={600} height={1199} draggable={false} />
        </button>
      )}

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
            <div className={styles.popupEmoji} aria-hidden="true">{SABORES[error.elegido].emoji} ❌</div>
            <h3 id="popup-titulo" className={styles.popupTitulo}>¡Sabor equivocado!</h3>
            <p id="popup-texto" className={styles.popupTexto}>
              Elegiste <strong>{SABORES[error.elegido].nombre}</strong>, pero el pedido pide{' '}
              <strong>{SABORES[error.esperado].emoji} {SABORES[error.esperado].nombre}</strong>.
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