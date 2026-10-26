
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
    setTiempo(60);
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
  
    <main className="min-h-screen bg-[#eee9e2] p-3 sm:p-6 font-sans" style={{backgroundImage: "url(cocina.png)", width:1500, height: 700}}>
      <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl bg-[#fffaf1] shadow-xl">

        {/* Barra superior */}
        <header className="flex flex-wrap items-center justify-between gap-3 bg-[#fffaf1] p-4">
          <div className="flex items-center gap-2 font-extrabold text-[#692d20]">
            <span className="text-2xl">◷</span>
            <span className="text-xl">{formatearTiempo(tiempo)}</span>
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

        {/* Pedido del cliente */}
        <section className="mx-3 rounded-2xl border-2 border-[#713629] bg-[#fff4df] p-3 sm:mx-5 sm:p-4">
          <h2 className="mb-3 text-center text-lg font-extrabold text-[#54251c]">
            PEDIDO DEL CLIENTE
          </h2>

          <div className="flex min-h-16 flex-wrap items-center justify-center gap-1">
            {recetaObjetivo.map((ingrediente, indice) => (
              <img
                key={`${ingrediente.id}-${indice}`}
                src={ingrediente.tipo}
                alt={ingrediente.nombre}
                title={ingrediente.nombre}
                className="h-12 w-12 object-contain sm:h-14 sm:w-14"
              />
            ))}
          </div>
        </section>

        {/* Zona de armado */}
        <section className="zona-armado">
          <h2 className="titulo-hamburguesa">
            TU HAMBURGUESA
          </h2>

          <div className="plato-hamburguesa">
            {miHamburguesa.length === 0 ? (
              <p className="mensaje-vacio">
                ¡Elegí los ingredientes para empezar!
              </p>
            ) : (
              <div className="pila-hamburguesa">
                {miHamburguesa.map((ingrediente, indice) => (
                  <img
                    key={`${ingrediente.id}-${indice}`}
                    src={ingrediente.tipo}
                    alt={ingrediente.nombre}
                    title={ingrediente.nombre}
                    className="imagen-ingrediente"
                    style={{
                      order: indice,
                      zIndex: indice + 1,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Botones de ingredientes */}
        <section className="bg-[#fffaf1] p-4 sm:p-5">
          <h2 className="mb-3 text-center text-lg font-extrabold text-[#54251c]">
            INGREDIENTES
          </h2>

          <div className="mb-4 flex flex-wrap justify-center gap-2">
            {[
              { valor: 'todos', texto: 'Todos' },
              { valor: 'abajo', texto: 'Panes base' },
              { valor: 'carnes', texto: 'Carnes' },
              { valor: 'quesos', texto: 'Quesos' },
              { valor: 'medio', texto: 'Otros' },
              { valor: 'arriba', texto: 'Panes superiores' },
            ].map((seccion) => (
              <button
                key={seccion.valor}
                onClick={() => setFiltroSeccion(seccion.valor)}
                className={`rounded-full border px-3 py-2 text-sm font-bold transition ${
                  filtroSeccion === seccion.valor
                    ? 'border-amber-900 bg-amber-800 text-white'
                    : 'border-amber-900/20 bg-white text-amber-950 hover:bg-amber-100'
                }`}
              >
                {seccion.texto}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {ingredientesFiltrados.map((ingrediente) => (
              <button
                key={ingrediente.id}
                onClick={() => agregarIngrediente(ingrediente)}
                disabled={pausado || tiempo <= 0}
                className="flex min-h-24 flex-col items-center justify-center rounded-xl border-2 border-[#e1c9a9] bg-white p-3 transition hover:border-amber-700 hover:bg-amber-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <img
                  src={`${ingrediente.tipo}`}
                  alt={ingrediente.nombre}
                  className="h-12 w-14 object-contain"
                />
                <span className="mt-1 text-center text-sm font-bold text-[#54251c]">
                  {ingrediente.nombre}
                </span>
              </button>
            ))}
          </div>

          {/* Botones de acción */}
          <div className="mt-5 flex flex-wrap gap-3">
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
 //......
  
}
