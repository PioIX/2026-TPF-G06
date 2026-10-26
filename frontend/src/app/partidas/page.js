'use client';

import { useState, useEffect, useRef } from 'react';
import './partidas.css';

const API_URL = 'http://localhost:4000/api';

const TIEMPO_INICIAL = 60;

// Imágenes (van en la carpeta /public)
const PAPAS_IMG = '/papas.png';
const BEBIDA_IMG = '/bebida.png';

// Tamaño de la hamburguesa respecto al plato del fondo (1 = tamaño base).
const TAM_HAMBURGUESA = 1.3;

// Ancho de referencia de la cocina (1672 px). Sirve para pasar px a % del escenario.
const ANCHO_REF = 1672;

const TAMANOS = ['chica', 'mediana', 'grande'];

// Ancho de la imagen en la escena (en cqw) según el tamaño pedido
const TAM_PAPAS = { chica: 8, mediana: 10, grande: 12 };
const TAM_BEBIDA = { chica: 8, mediana: 10.5, grande: 13 };

// En las tarjetas del menú se muestran más chicas que en la escena
const FACTOR_TARJETA = 0.45;

const SECCIONES = [
  { valor: 'todos', texto: 'Todos' },
  { valor: 'abajo', texto: 'Panes base' },
  { valor: 'carnes', texto: 'Carnes' },
  { valor: 'quesos', texto: 'Quesos' },
  { valor: 'medio', texto: 'Otros' },
  { valor: 'arriba', texto: 'Panes sup.' },
  { valor: 'papas', texto: '🍟 Papas', extra: true },
  { valor: 'bebida', texto: '🥤 Bebida', extra: true },
];

const etiquetaPapas = (t) => `Papas ${t === 'grande' ? 'grandes' : t + 's'}`;
const etiquetaBebida = (t) => `Cola ${t}`;

export default function JuegoHamburguesa() {
  const [todosLosIngredientes, setTodosLosIngredientes] = useState([]);
  const [pedido, setPedido] = useState({ hamburguesa: [], papas: null, bebida: null });
  const [miHamburguesa, setMiHamburguesa] = useState([]);
  const [papasElegidas, setPapasElegidas] = useState(null); // 'chica' | 'mediana' | 'grande' | null
  const [bebidaElegida, setBebidaElegida] = useState(null);
  const [filtroSeccion, setFiltroSeccion] = useState('todos');

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [tiempo, setTiempo] = useState(TIEMPO_INICIAL);
  const [puntaje, setPuntaje] = useState(350);
  const [pausado, setPausado] = useState(false);

  const [mensaje, setMensaje] = useState(null); // { texto, tipo: 'ok' | 'mal' }
  const timeoutMensaje = useRef(null);

  const recetaObjetivo = pedido.hamburguesa;

  const mostrarMensaje = (texto, tipo) => {
    setMensaje({ texto, tipo });
    clearTimeout(timeoutMensaje.current);
    timeoutMensaje.current = setTimeout(() => setMensaje(null), 2000);
  };

  useEffect(() => () => clearTimeout(timeoutMensaje.current), []);

  // Obtener ingredientes y pedido aleatorio completo
  const iniciarJuego = async () => {
    setCargando(true);
    setError('');
    setMiHamburguesa([]);
    setPapasElegidas(null);
    setBebidaElegida(null);
    setMensaje(null);
    setTiempo(TIEMPO_INICIAL);
    setPausado(false);

    try {
      const [resPedido, resIngredientes] = await Promise.all([
        fetch(`${API_URL}/pedido-aleatorio`),
        fetch(`${API_URL}/ingredientes`),
      ]);

      if (!resPedido.ok) {
        throw new Error(
          `/pedido-aleatorio respondió ${resPedido.status}. ` +
            (resPedido.status === 404
              ? 'El backend no tiene ese endpoint: pegalo en index.js y reiniciá el servidor.'
              : 'Mirá la consola del backend para ver el error.')
        );
      }
      if (!resIngredientes.ok) {
        throw new Error(`/ingredientes respondió ${resIngredientes.status}.`);
      }

      const pedidoData = await resPedido.json();
      const ingredientesData = await resIngredientes.json();

      if (!pedidoData || !Array.isArray(pedidoData.hamburguesa) || !Array.isArray(ingredientesData)) {
        throw new Error('La respuesta del servidor no es válida.');
      }

      setPedido({
        hamburguesa: pedidoData.hamburguesa,
        papas: pedidoData.papas ?? null,
        bebida: pedidoData.bebida ?? null,
      });
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

  // Elegir un tamaño; tocar el mismo tamaño otra vez lo quita
  const elegirPapas = (tamano) => {
    if (juegoBloqueado) return;
    setPapasElegidas((actual) => (actual === tamano ? null : tamano));
  };
  const elegirBebida = (tamano) => {
    if (juegoBloqueado) return;
    setBebidaElegida((actual) => (actual === tamano ? null : tamano));
  };

  const verificar = () => {
    if (juegoBloqueado) return;

    if (miHamburguesa.length !== recetaObjetivo.length) {
      mostrarMensaje('¡La cantidad de ingredientes no coincide!', 'mal');
      return;
    }

    const hamburguesaOk = miHamburguesa.every(
      (ingrediente, indice) => ingrediente.id === recetaObjetivo[indice].id
    );
    if (!hamburguesaOk) {
      mostrarMensaje('La hamburguesa no coincide. ¡Probá de nuevo!', 'mal');
      return;
    }

    const papasPedidas = pedido.papas ?? null;
    if (papasElegidas !== papasPedidas) {
      mostrarMensaje(
        !papasPedidas
          ? 'El cliente no pidió papas.'
          : !papasElegidas
          ? 'Faltan las papas.'
          : 'Las papas no son del tamaño pedido.',
        'mal'
      );
      return;
    }

    const bebidaPedida = pedido.bebida?.tamano ?? null;
    if (bebidaElegida !== bebidaPedida) {
      mostrarMensaje(
        !bebidaPedida
          ? 'El cliente no pidió bebida.'
          : !bebidaElegida
          ? 'Falta la bebida.'
          : 'La bebida no es del tamaño pedido.',
        'mal'
      );
      return;
    }

    // Más puntos por pedidos más completos
    const extras = (papasPedidas ? 1 : 0) + (bebidaPedida ? 1 : 0);
    const ganados = 100 + extras * 40;
    setPuntaje((anterior) => anterior + ganados);
    mostrarMensaje(`¡Pedido correcto! +${ganados} puntos`, 'ok');
    setTimeout(iniciarJuego, 1200);
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

  const estadoExtra = (elegido, pedido_) =>
    elegido == null ? '' : elegido === pedido_ ? 'bien' : 'mal';

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

  const mostrandoTamanos = filtroSeccion === 'papas' || filtroSeccion === 'bebida';

  return (
    <main className="juego">
      {/* ───────── Escenario: la cocina de fondo ───────── */}
      <div className="escenario">
        {/* HUD flotante: tiempo, puntaje y controles */}
        <header className="hud">
          <div className="dato dato-tiempo">
            <span className="dato-icono">◷</span>
            <span>{formatearTiempo(tiempo)}</span>
          </div>

          <div className="dato dato-puntaje">
            <span className="dato-icono">★</span>
            <span>{puntaje}</span>
          </div>

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
        </header>

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

            {(pedido.papas || pedido.bebida) && (
              <>
                <div className="ticket-seccion">ACOMPAÑAMIENTO</div>
                <ul className="ticket-lista ticket-extras">
                  {pedido.papas && (
                    <li
                      className={`ticket-item ${estadoExtra(papasElegidas, pedido.papas)}`}
                    >
                      <span className="ticket-num">+</span>
                      <img src={PAPAS_IMG} alt="Papas" className="ticket-img" />
                      <span className="ticket-nombre">{etiquetaPapas(pedido.papas)}</span>
                      <span className="ticket-check">
                        {estadoExtra(papasElegidas, pedido.papas) === 'bien'
                          ? '✓'
                          : estadoExtra(papasElegidas, pedido.papas) === 'mal'
                          ? '✗'
                          : ''}
                      </span>
                    </li>
                  )}
                  {pedido.bebida && (
                    <li
                      className={`ticket-item ${estadoExtra(
                        bebidaElegida,
                        pedido.bebida.tamano
                      )}`}
                    >
                      <span className="ticket-num">+</span>
                      <img src={BEBIDA_IMG} alt="Bebida" className="ticket-img" />
                      <span className="ticket-nombre">
                        {etiquetaBebida(pedido.bebida.tamano)}
                      </span>
                      <span className="ticket-check">
                        {estadoExtra(bebidaElegida, pedido.bebida.tamano) === 'bien'
                          ? '✓'
                          : estadoExtra(bebidaElegida, pedido.bebida.tamano) === 'mal'
                          ? '✗'
                          : ''}
                      </span>
                    </li>
                  )}
                </ul>
              </>
            )}

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

        {/* Bebida (izquierda del plato) */}
        {bebidaElegida && (
          <img
            key={`bebida-${bebidaElegida}`}
            src={BEBIDA_IMG}
            alt="Bebida"
            title="Tocá para quitar"
            className="extra-escena extra-bebida"
            style={{ width: `${TAM_BEBIDA[bebidaElegida]}cqw` }}
            onClick={() => !juegoBloqueado && setBebidaElegida(null)}
          />
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

        {/* Papas (derecha del plato) */}
        {papasElegidas && (
          <img
            key={`papas-${papasElegidas}`}
            src={PAPAS_IMG}
            alt="Papas"
            title="Tocá para quitar"
            className="extra-escena extra-papas"
            style={{ width: `${TAM_PAPAS[papasElegidas]}cqw` }}
            onClick={() => !juegoBloqueado && setPapasElegidas(null)}
          />
        )}

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
                  className={`pestana ${seccion.extra ? 'extra' : ''} ${
                    filtroSeccion === seccion.valor ? 'activa' : ''
                  }`}
                >
                  {seccion.texto}
                </button>
              ))}
            </div>

            <div className="bandeja">
              {mostrandoTamanos ? (
                <div className="rejilla-tamanos">
                  {TAMANOS.map((tamano) => {
                    const esPapas = filtroSeccion === 'papas';
                    const seleccionado = esPapas
                      ? papasElegidas === tamano
                      : bebidaElegida === tamano;
                    const ancho =
                      (esPapas ? TAM_PAPAS : TAM_BEBIDA)[tamano] * FACTOR_TARJETA;

                    return (
                      <button
                        key={tamano}
                        onClick={() =>
                          esPapas ? elegirPapas(tamano) : elegirBebida(tamano)
                        }
                        disabled={juegoBloqueado}
                        className={`tarjeta-tamano ${seleccionado ? 'sel' : ''}`}
                      >
                        <span className="tarjeta-tamano-img">
                          <img
                            src={esPapas ? PAPAS_IMG : BEBIDA_IMG}
                            alt={esPapas ? 'Papas' : 'Bebida'}
                            style={{ width: `${ancho}cqw` }}
                          />
                        </span>
                        <span className="tarjeta-tamano-nombre">{tamano}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
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
              )}
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