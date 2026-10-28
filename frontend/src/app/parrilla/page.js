'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import './parrilla.css';

/* =========================================================
   CONFIGURACIÓN (todo se puede ajustar acá)
   ========================================================= */

const RUTA_COCINA = '/partidas';

// Segundos que tarda en cocinarse CADA lado
const COCCION = { paty: 8, pollo: 10, veggie: 6 };

// Segundos de margen, una vez cocido el lado, para darle la vuelta
// (o sacarla) antes de que se queme. Mientras tanto se va oscureciendo.
const GRACIA = 3.5;

const DURACION_VOLTEO = 0.8; // segundos que dura la animación de dar vuelta
const ESPERA_COCINADA = 1.8; // segundos mostrando "¡en su punto!" antes de volver
const ESPERA_QUEMADA = 2.6; // segundos mostrando "¡se quemó!" antes de volver

/* =========================================================
   UTILIDADES
   ========================================================= */

const normalizar = (texto = '') =>
  String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const tipoCarne = (ing) => {
  const n = normalizar(ing?.nombre);
  if (n.includes('pollo')) return 'pollo';
  if (n.includes('veg')) return 'veggie';
  return 'paty';
};

const formatearTiempo = (segundos) => {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const calcularRestante = (p) =>
  Math.max(
    0,
    (p.tiempo ?? 999999) -
      Math.floor((Date.now() - (p.guardadoEn ?? Date.now())) / 1000)
  );

const limitar = (n, min, max) => Math.min(max, Math.max(min, n));

/* ---------------------------------------------------------
   A partir del PNG de la carne (que se toma como "cocida") se
   generan solas las otras dos versiones, así no hace falta
   ninguna imagen extra:
     - cruda:   mismo relieve pero rosada / pálida
     - quemada: mismo relieve pero negra, con manchas y cenizas
   --------------------------------------------------------- */
const COLOR_CRUDO = {
  paty: [200, 88, 96],
  pollo: [244, 224, 196], // pálido/crema: así se ve el pollo crudo (no rosado como la vaca)
  veggie: [170, 192, 100],
};

const crearVariantes = (src, tipo) =>
  new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;

      try {
        const lienzo = document.createElement('canvas');
        lienzo.width = w;
        lienzo.height = h;
        const ctx = lienzo.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);

        // Recortar bordes transparentes
        const completa = ctx.getImageData(0, 0, w, h).data;
        let minX = w, minY = h, maxX = -1, maxY = -1;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            if (completa[(y * w + x) * 4 + 3] > 12) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (maxX < 0) throw new Error('imagen vacía');

        const cw = maxX - minX + 1;
        const ch = maxY - minY + 1;
        const recorte = ctx.getImageData(minX, minY, cw, ch);
        const d = recorte.data;

        // Luminosidad media (para conservar el relieve de la imagen)
        let suma = 0;
        let cuenta = 0;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] > 128) {
            suma += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            cuenta++;
          }
        }
        const media = cuenta ? suma / cuenta : 128;

        const crudo = ctx.createImageData(cw, ch);
        const quemado = ctx.createImageData(cw, ch);
        const base = COLOR_CRUDO[tipo] ?? COLOR_CRUDO.paty;

        for (let i = 0; i < d.length; i += 4) {
          const a = d[i + 3];
          crudo.data[i + 3] = a;
          quemado.data[i + 3] = a;
          if (a === 0) continue;

          const lum =
            (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / (media || 1);
          const px = (i / 4) % cw;
          const py = Math.floor(i / 4 / cw);
          const azar = ((px * 374761393 + py * 668265263) >>> 0) % 100;

          // Cruda
          const kc = limitar(0.55 + 0.45 * lum, 0.4, 1.3);
          crudo.data[i] = Math.min(255, base[0] * kc);
          crudo.data[i + 1] = Math.min(255, base[1] * kc);
          crudo.data[i + 2] = Math.min(255, base[2] * kc);

          // Quemada (carbón con manchas más oscuras y algunas cenizas)
          let kq = limitar(0.5 + 0.6 * lum, 0.3, 1.4);
          if (azar > 90) kq *= 0.5;
          let r = 54 * kq;
          let g = 37 * kq;
          let b = 28 * kq;
          if (azar < 4) {
            r = 112;
            g = 106;
            b = 100;
          }
          quemado.data[i] = Math.min(255, r);
          quemado.data[i + 1] = Math.min(255, g);
          quemado.data[i + 2] = Math.min(255, b);
        }

        const aURL = (imageData) => {
          const c = document.createElement('canvas');
          c.width = cw;
          c.height = ch;
          c.getContext('2d').putImageData(imageData, 0, 0);
          return c.toDataURL('image/png');
        };

        resolve({
          crudo: aURL(crudo),
          cocido: aURL(recorte),
          quemado: aURL(quemado),
          w: cw,
          h: ch,
          fallback: false,
        });
      } catch (e) {
        resolve({ crudo: src, cocido: src, quemado: src, w: w || 1, h: h || 1, fallback: true });
      }
    };

    img.onerror = () =>
      resolve({ crudo: src, cocido: src, quemado: src, w: 1, h: 1, fallback: true });
    img.src = src;
  });

/* =========================================================
   PÁGINA DE LA PARRILLA
   ========================================================= */

export default function Parrilla() {
  const router = useRouter();

  const [leida, setLeida] = useState(false);
  const [partida, setPartida] = useState(null);
  const [variantes, setVariantes] = useState(null);

  // fase: 'lado1' | 'volteando' | 'lado2' | 'cocinada' | 'quemada'
  const [fase, setFase] = useState('lado1');
  const [lado, setLado] = useState(1);
  const [t, setT] = useState(0); // segundos cocinando el lado actual
  const [tiempoJuego, setTiempoJuego] = useState(null);
  const [aviso, setAviso] = useState('');
  const [sacudir, setSacudir] = useState(false);

  const faseRef = useRef('lado1');
  const tRef = useRef(0);
  const terminadoRef = useRef(false);
  const temporizadoresRef = useRef([]);

  const ingrediente = partida?.ingredienteACocinar ?? null;
  const tipo = tipoCarne(ingrediente);
  const coccion = COCCION[tipo];

  const programar = (fn, segundos) => {
    const id = setTimeout(fn, segundos * 1000);
    temporizadoresRef.current.push(id);
  };

  // Leer la partida que dejó la cocina
  useEffect(() => {
    try {
      const texto = sessionStorage.getItem('partida');
      if (texto) {
        const guardada = JSON.parse(texto);
        if (guardada?.ingredienteACocinar) setPartida(guardada);
      }
    } catch (e) {
      /* sin partida */
    }
    setLeida(true);

    return () => temporizadoresRef.current.forEach(clearTimeout);
  }, []);

  // Generar las versiones cruda / cocida / quemada de la carne
  useEffect(() => {
    if (!ingrediente?.tipo) return;
    let cancelado = false;
    crearVariantes(ingrediente.tipo, tipoCarne(ingrediente)).then((v) => {
      if (!cancelado) setVariantes(v);
    });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingrediente?.tipo]);

  /* ---------- salir de la parrilla ---------- */

  // Guarda el resultado y vuelve a la cocina
  const volverACocina = (resultado) => {
    try {
      sessionStorage.setItem(
        'partida',
        JSON.stringify({
          ...partida,
          tiempo: calcularRestante(partida),
          guardadoEn: Date.now(),
          resultadoParrilla: resultado, // 'cocinada' | 'quemada' | 'cancelada'
        })
      );
    } catch (e) {
      /* ignorar */
    }
    router.push(RUTA_COCINA);
  };

  // Volver ya mismo (botón "Volver" o se acabó el tiempo del juego)
  const terminar = (resultado) => {
    if (terminadoRef.current) return;
    terminadoRef.current = true;
    volverACocina(resultado);
  };

  // Mostrar el resultado un momento y después volver
  const finalizar = (resultado) => {
    if (terminadoRef.current) return;
    terminadoRef.current = true;
    faseRef.current = resultado;
    setFase(resultado);
    programar(
      () => volverACocina(resultado),
      resultado === 'quemada' ? ESPERA_QUEMADA : ESPERA_COCINADA
    );
  };

  /* ---------- reloj de cocción ---------- */
  useEffect(() => {
    if (!variantes || !partida) return;

    let raf;
    let ultimo = performance.now();

    const bucle = (ahora) => {
      const dt = Math.min(0.1, (ahora - ultimo) / 1000);
      ultimo = ahora;

      // Tiempo total de la partida (sigue corriendo mientras cocinás)
      const restante = calcularRestante(partida);
      setTiempoJuego(restante);
      if (restante <= 0 && !terminadoRef.current) {
        terminar('cancelada');
        return;
      }

      const f = faseRef.current;
      if (f === 'lado1' || f === 'lado2') {
        tRef.current += dt;

        if (tRef.current >= coccion + GRACIA) {
          // Se pasó del margen: se quema
          tRef.current = coccion + GRACIA;
          setT(tRef.current);
          finalizar('quemada');
        } else {
          setT(tRef.current);
        }
      }

      raf = requestAnimationFrame(bucle);
    };

    raf = requestAnimationFrame(bucle);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantes, partida]);

  /* ---------- acción del jugador: dar vuelta / sacar ---------- */
  const avisar = (texto) => {
    setAviso(texto);
    setSacudir(true);
    programar(() => setSacudir(false), 0.4);
    programar(() => setAviso(''), 1.8);
  };

  const accionCarne = () => {
    const f = faseRef.current;
    if (f !== 'lado1' && f !== 'lado2') return;

    // Todavía no se cocinó este lado
    if (tRef.current < coccion) {
      avisar(
        f === 'lado1'
          ? '¡Todavía no! Este lado está crudo'
          : '¡Todavía no! Falta cocinarla'
      );
      return;
    }

    if (f === 'lado1') {
      // Dar la vuelta: a mitad de la animación se cambia de lado
      faseRef.current = 'volteando';
      setFase('volteando');
      programar(() => {
        tRef.current = 0;
        setT(0);
        setLado(2);
      }, DURACION_VOLTEO / 2);
      programar(() => {
        faseRef.current = 'lado2';
        setFase('lado2');
      }, DURACION_VOLTEO);
    } else {
      // Segundo lado listo: se saca de la parrilla
      finalizar('cocinada');
    }
  };

  /* ---------- valores para dibujar ---------- */
  const cocinandoLado = fase === 'lado1' || fase === 'lado2' || fase === 'volteando';
  const progreso = Math.min(1, t / coccion); // 0 → 1 (cruda → cocida)
  const quemado = t > coccion ? Math.min(1, (t - coccion) / GRACIA) : 0; // 0 → 1
  const listo = (fase === 'lado1' || fase === 'lado2') && t >= coccion;
  const segundosParaListo = Math.max(0, Math.ceil(coccion - t));
  const segundosParaQuemar = Math.max(0, Math.ceil(GRACIA - (t - coccion)));

  const opacidadCocido = fase === 'quemada' ? 1 : progreso;
  const opacidadQuemado = fase === 'quemada' ? 1 : quemado;

  // Reloj circular
  const pctReloj = listo ? 1 - quemado : progreso;
  const textoReloj = listo ? segundosParaQuemar : segundosParaListo;
  const etiquetaReloj = listo
    ? lado === 1
      ? '¡DALE LA VUELTA!'
      : '¡SACALA YA!'
    : lado === 1
    ? 'para dar vuelta'
    : 'para sacarla';

  const mensajeGuia =
    fase === 'volteando'
      ? 'Dando la vuelta…'
      : listo
      ? lado === 1
        ? '¡Tocá la carne para darle la vuelta!'
        : '¡Tocá la carne para sacarla de la parrilla!'
      : lado === 1
      ? 'Cocinando el primer lado…'
      : 'Cocinando el segundo lado…';

  /* ---------- pantallas de espera ---------- */
  if (!leida) {
    return (
      <main className="parrilla centrado">
        <p className="p-mensaje">Encendiendo la parrilla…</p>
      </main>
    );
  }

  if (!partida) {
    return (
      <main className="parrilla centrado">
        <div className="p-tarjeta">
          <p className="p-mensaje">No hay ninguna carne para cocinar 🥩</p>
          <button className="p-boton" onClick={() => router.push(RUTA_COCINA)}>
            Volver a la cocina
          </button>
        </div>
      </main>
    );
  }

  if (!variantes) {
    return (
      <main className="parrilla centrado">
        <p className="p-mensaje">Preparando la carne…</p>
      </main>
    );
  }

  const humo = quemado > 0.35 || fase === 'quemada';
  const fuego = quemado > 0.75 || fase === 'quemada';

  return (
    <main className={`parrilla ${variantes.fallback ? 'sin-variantes' : ''}`}>
      {/* ---------- ESCENA: la foto de la parrilla ---------- */}
      <div className="escena">
        {/* Brasas bajo la carne: se intensifican a medida que se cocina */}
        <div
          className="brasa"
          style={{ opacity: 0.35 + 0.5 * Math.max(progreso, quemado) }}
        />

        {/* La carne */}
        <div className="zona-carne">
          <div className="sombra-carne" />

          <div
            className={`carne ${fase === 'volteando' ? 'voltear' : ''} ${
              listo ? 'lista' : ''
            } ${quemado > 0.5 ? 'peligro' : ''} ${sacudir ? 'sacudir' : ''} ${
              fase === 'cocinada' ? 'servida' : ''
            }`}
            style={{
              aspectRatio: `${variantes.w} / ${variantes.h}`,
              animationDuration:
                fase === 'volteando' ? `${DURACION_VOLTEO}s` : undefined,
            }}
            onClick={accionCarne}
            title={ingrediente?.nombre}
          >
            <img className="capa capa-crudo" src={variantes.crudo} alt="" draggable={false} />
            <img
              className="capa capa-cocido"
              src={variantes.cocido}
              alt={ingrediente?.nombre}
              draggable={false}
              style={{ opacity: opacidadCocido }}
            />
            <img
              className="capa capa-quemado"
              src={variantes.quemado}
              alt=""
              draggable={false}
              style={{ opacity: opacidadQuemado }}
            />
          </div>

          {/* Vapor mientras se cocina */}
          {cocinandoLado && fase !== 'volteando' && !humo && (
            <div className="efectos">
              {[12, 30, 48, 66, 84].map((x, i) => (
                <span
                  key={x}
                  className="vapor"
                  style={{ left: `${x}%`, animationDelay: `${i * 0.35}s` }}
                />
              ))}
            </div>
          )}

          {/* Humo negro cuando se está pasando */}
          {humo && (
            <div className="efectos">
              {[14, 32, 50, 68, 86].map((x, i) => (
                <span
                  key={x}
                  className="humo"
                  style={{ left: `${x}%`, animationDelay: `${i * 0.25}s` }}
                />
              ))}
            </div>
          )}

          {/* Llamas */}
          {fuego && (
            <div className="efectos">
              {[22, 50, 78].map((x, i) => (
                <span
                  key={x}
                  className="llama"
                  style={{ left: `${x}%`, animationDelay: `${i * 0.18}s` }}
                >
                  🔥
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ---------- RELOJ + ESTADO (sobre la parrilla, a la derecha) ---------- */}
        <aside className="p-panel">
          <p className="p-nombre">{ingrediente?.nombre}</p>

          <div className="p-lados">
            <span className={`p-lado ${lado === 1 ? 'activo' : 'hecho'}`}>
              {lado === 1 ? 'Lado 1' : 'Lado 1 ✓'}
            </span>
            <span
              className={`p-lado ${lado === 2 ? 'activo' : ''} ${
                fase === 'cocinada' ? 'hecho' : ''
              }`}
            >
              {fase === 'cocinada' ? 'Lado 2 ✓' : 'Lado 2'}
            </span>
          </div>

          <div
            className={`reloj ${listo ? 'urgente' : ''}`}
            style={{ '--pct': `${pctReloj * 360}deg` }}
          >
            <div className="reloj-centro">
              <strong>{fase === 'volteando' ? '…' : textoReloj}</strong>
              <small>{fase === 'volteando' ? '' : etiquetaReloj}</small>
            </div>
          </div>

          <button
            className={`p-accion ${listo ? 'activo' : ''}`}
            onClick={accionCarne}
            disabled={fase !== 'lado1' && fase !== 'lado2'}
          >
            {lado === 1 ? '↻ DAR VUELTA' : '✓ SACAR'}
          </button>
        </aside>

        {/* Mensaje sobre el borde de acero de la parrilla */}
        <p className={`p-guia ${listo ? 'urgente' : ''}`}>{mensajeGuia}</p>
      </div>

      {/* ---------- BARRA SUPERIOR ---------- */}
      <header className="p-hud">
        <button
          className="p-volver"
          onClick={() => terminar('cancelada')}
          disabled={fase === 'cocinada' || fase === 'quemada'}
        >
          ← Volver a la cocina
        </button>

        <h1 className="p-titulo">PARRILLA</h1>

        <div className="p-datos">
          <span>◷ {formatearTiempo(tiempoJuego ?? calcularRestante(partida))}</span>
          <span>★ {partida.puntaje ?? 0}</span>
        </div>
      </header>

      {/* ---------- AYUDA ---------- */}
      <footer className="p-ayuda">
        Esperá a que el reloj llegue a 0, dale la vuelta, y sacala del otro lado
        a tiempo. Si te pasás, ¡se quema!
      </footer>

      {aviso && <div className="p-aviso">{aviso}</div>}

      {/* ---------- RESULTADO ---------- */}
      {fase === 'cocinada' && (
        <div className="p-resultado">
          <div className="p-resultado-card bien">
            <span className="grande">🍖</span>
            <h2>¡Carne en su punto!</h2>
            <p>Volviendo a la cocina…</p>
          </div>
        </div>
      )}

      {fase === 'quemada' && (
        <div className="p-resultado">
          <div className="p-resultado-card mal">
            <span className="grande">🔥</span>
            <h2>¡Se quemó la carne!</h2>
            <p>Volvé a la cocina y agarrá otra para cocinarla de nuevo.</p>
          </div>
        </div>
      )}
    </main>
  );
}