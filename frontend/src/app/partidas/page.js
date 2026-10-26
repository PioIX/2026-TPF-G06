'use client';

import { useState, useEffect, useRef } from 'react';
import './partidas.css';

const API_URL = 'http://localhost:4000/api';

const TIEMPO_INICIAL = 60;

// Tamaño de la hamburguesa respecto al plato del fondo (1 = tamaño base).
const TAM_HAMBURGUESA = 1.3;

// Ancho de referencia de cocina.png (1672 px). Sirve para pasar px a % del escenario.
const ANCHO_REF = 1672;

const SECCIONES = [
  { valor: 'todos', texto: 'Todos' },
  { valor: 'abajo', texto: 'Panes base' },
  { valor: 'carnes', texto: 'Carnes' },
  { valor: 'quesos', texto: 'Quesos' },
  { valor: 'medio', texto: 'Otros' },
  { valor: 'arriba', texto: 'Panes sup.' },
];

export default function JuegoHamburguesa() {
  const [todosLosIngredientes, setTodosLosIngredientes] = useState([]);
  const [recetaObjetivo, setRecetaObjetivo] = useState([]);
  const [miHamburguesa, setMiHamburguesa] = useState([]);
  const [filtroSeccion, setFiltroSeccion] = useState('todos');

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [tiempo, setTiempo] = useState(TIEMPO_INICIAL);
  const [puntaje, setPuntaje] = useState(350);
  const [pausado, setPausado] = useState(false);

  const [mensaje, setMensaje] = useState(null); // { texto, tipo: 'ok' | 'mal' }
  const timeoutMensaje = useRef(null);

  const mostrarMensaje = (texto, tipo) => {
    setMensaje({ texto, tipo });
    clearTimeout(timeoutMensaje.current);
    timeoutMensaje.current = setTimeout(() => setMensaje(null), 1800);
  };

  useEffect(() => () => clearTimeout(timeoutMensaje.current), []);

  // Obtener ingredientes y pedido aleatorio
  const iniciarJuego = async () => {
    setCargando(true);
    setError('');
    setMiHamburguesa([]);
    setMensaje(null);
    setTiempo(TIEMPO_INICIAL);
    setPausado(false);

    try {
      const [resOrden, resIngredientes] = await Promise.all([
        fetch(`${API_URL}/orden-aleatoria`),
        fetch(`${API_URL}/ingredientes`),
      ]);

      if (!resOrden.ok || !resIngredientes.ok) {
        throw new Error('No se pudieron obtener los datos.');
      }

      const ordenData = await resOrden.json();
      const ingredientesData = await resIngredientes.json();

      if (!Array.isArray(ordenData) || !Array.isArray(ingredientesData)) {
        throw new Error('La respuesta del servidor no es válida.');
      }

      setRecetaObjetivo(ordenData);
      setTodosLosIngredientes(ingredientesData);
    } catch (err) {
      console.error('Error al conectar con el backend:', err);
      setError(
        'No se pudo conectar con el servidor. Comprobá que el backend esté funcionando.'
      );
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    iniciarJuego();
  }, []);

  // Cronómetro
  useEffect(() => {
    if (cargando || pausado || tiempo <= 0 || error) return;

    const intervalo = setInterval(() => {
      setTiempo((anterior) => Math.max(0, anterior - 1));
    }, 1000);

    return () => clearInterval(intervalo);
  }, [cargando, pausado, tiempo, error]);

  const juegoBloqueado = pausado || tiempo <= 0 || cargando || !!error;

  const agregarIngrediente = (ingrediente) => {
    if (juegoBloqueado) return;
    setMiHamburguesa((anterior) => [...anterior, ingrediente]);
  };

  const deshacer = () => {
    if (juegoBloqueado) return;
    setMiHamburguesa((anterior) => anterior.slice(0, -1));
  };

  const verificar = () => {
    if (juegoBloqueado) return;

    if (miHamburguesa.length !== recetaObjetivo.length) {
      mostrarMensaje('¡La cantidad de ingredientes no coincide!', 'mal');
      return;
    }

    const esCorrecta = miHamburguesa.every(
      (ingrediente, indice) => ingrediente.id === recetaObjetivo[indice].id
    );

    if (esCorrecta) {
      setPuntaje((anterior) => anterior + 100);
      mostrarMensaje('¡Pedido correcto! +100 puntos', 'ok');
      setTimeout(iniciarJuego, 1200);
    } else {
      mostrarMensaje('El pedido no coincide. ¡Probá de nuevo!', 'mal');
    }
  };

  const ingredientesFiltrados =
    filtroSeccion === 'todos'
      ? todosLosIngredientes
      : todosLosIngredientes.filter((i) => i.seccion === filtroSeccion);

  const formatearTiempo = (segundos) => {
    const minutos = Math.floor(segundos / 60);
    const resto = segundos % 60;
    return `${String(minutos).padStart(2, '0')}:${String(resto).padStart(2, '0')}`;
  };

  // Ancho base (px sobre una imagen de 1672 de ancho) -> % del escenario
  const anchoBase = (nombre) => {
    if (nombre === 'pan abajo' || nombre === 'pan arriba') return 160;
    if (nombre === 'paty' || nombre === 'pollo' || nombre === 'veggie') return 155;
    return 140;
  };
  const anchoEnCqw = (nombre) =>
    `${((anchoBase(nombre) * TAM_HAMBURGUESA) / ANCHO_REF) * 100}cqw`;

  // Si la hamburguesa se hace muy alta, se achica para no tapar el resto
  const escala = Math.max(0.5, Math.min(1, 7 / Math.max(miHamburguesa.length, 1)));

  if (cargando) {
    return (
      <main className="pantalla-centro">
        <p className="texto-cargando">Preparando la cocina...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="pantalla-centro">
        <p className="texto-error">{error}</p>
        <button onClick={iniciarJuego} className="btn btn-marron">
          Reintentar
        </button>
      </main>
    );
  }

  return (
    <main className="juego">
      {/* ───────── Barra superior ───────── */}
      <header className="barra-superior">
        <div className="dato dato-tiempo">
          <span className="dato-icono">◷</span>
          <span>{formatearTiempo(tiempo)}</span>
        </div>

        <h1 className="logo">Fast Food Rush</h1>

        <div className="dato dato-puntaje">
          <span className="dato-icono">★</span>
          <span>{puntaje}</span>
        </div>

        <div className="barra-botones">
          <button
            onClick={() => setPausado(!pausado)}
            disabled={tiempo <= 0}
            className="btn btn-marron btn-chico"
          >
            {pausado ? 'Continuar' : 'Pausar'}
          </button>
          <button onClick={iniciarJuego} className="btn btn-claro btn-chico">
            Reiniciar
          </button>
        </div>
      </header>

      {/* ───────── Escenario: la cocina de fondo ───────── */}
      <div className="escenario">
        {/* Ticket del pedido, sobre la heladera (izquierda) */}
        <div className="ticket-wrap">
          <aside className="ticket" aria-label="Pedido del cliente">
            <h2 className="ticket-titulo">PEDIDO</h2>
            <p className="ticket-sub">Armalo de abajo hacia arriba</p>

            <ol className="ticket-lista">
              {recetaObjetivo.map((ingrediente, indice) => {
                const puesto = miHamburguesa[indice];
                const estado = !puesto
                  ? ''
                  : puesto.id === ingrediente.id
                  ? 'bien'
                  : 'mal';

                return (
                  <li
                    key={`${ingrediente.id}-${indice}`}
                    className={`ticket-item ${estado}`}
                  >
                    <span className="ticket-num">{indice + 1}</span>
                    <img
                      src={ingrediente.tipo}
                      alt={ingrediente.nombre}
                      className="ticket-img"
                    />
                    <span className="ticket-nombre">{ingrediente.nombre}</span>
                    <span className="ticket-check">
                      {estado === 'bien' ? '✓' : estado === 'mal' ? '✗' : ''}
                    </span>
                  </li>
                );
              })}
            </ol>

            <div className="ticket-total">
              {miHamburguesa.length} / {recetaObjetivo.length} ingredientes
            </div>
          </aside>
        </div>

        {/* Mensajes */}
        {mensaje && (
          <div className={`mensaje-flotante ${mensaje.tipo}`}>{mensaje.texto}</div>
        )}
        {miHamburguesa.length === 0 && (
          <p className="mensaje-vacio">¡Elegí los ingredientes para empezar!</p>
        )}

        {/* Hamburguesa, apoyada sobre el plato del fondo */}
        <div
          className="pila-hamburguesa"
          style={{ transform: `scale(${escala})`, '--tam': TAM_HAMBURGUESA }}
        >
          {miHamburguesa.map((ingrediente, indice) => (
            <img
              key={`${ingrediente.id}-${indice}`}
              src={ingrediente.tipo}
              alt={ingrediente.nombre}
              title={ingrediente.nombre}
              className="imagen-ingrediente"
              style={{ zIndex: indice + 1, width: anchoEnCqw(ingrediente.nombre) }}
            />
          ))}
        </div>

        {/* Bandeja de ingredientes (abajo) + acciones */}
        <div className="dock">
          <section className="mostrador">
            <div className="pestanas" role="tablist">
              {SECCIONES.map((seccion) => (
                <button
                  key={seccion.valor}
                  role="tab"
                  aria-selected={filtroSeccion === seccion.valor}
                  onClick={() => setFiltroSeccion(seccion.valor)}
                  className={`pestana ${
                    filtroSeccion === seccion.valor ? 'activa' : ''
                  }`}
                >
                  {seccion.texto}
                </button>
              ))}
            </div>

            <div className="bandeja">
              <div className="rejilla-ingredientes">
                {ingredientesFiltrados.map((ingrediente) => (
                  <button
                    key={ingrediente.id}
                    onClick={() => agregarIngrediente(ingrediente)}
                    disabled={juegoBloqueado}
                    className="tarjeta-ingrediente"
                  >
                    <img src={ingrediente.tipo} alt={ingrediente.nombre} />
                    <span>{ingrediente.nombre}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <div className="acciones">
            <button
              onClick={deshacer}
              disabled={miHamburguesa.length === 0 || juegoBloqueado}
              className="btn btn-marron btn-grande"
            >
              ↶ DESHACER
            </button>
            <button
              onClick={verificar}
              disabled={juegoBloqueado}
              className="btn btn-verde btn-grande"
            >
              ✓ ENTREGAR
            </button>
            {tiempo === 0 && (
              <p className="fin-tiempo">¡Se acabó el tiempo! Reiniciá.</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}