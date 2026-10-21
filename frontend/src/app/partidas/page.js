/*
'use client';

import { useState, useEffect } from 'react';
import './partidas.css';


const API_URL = 'http://localhost:4000/api';

import './partidas.css';

export default function JuegoHamburguesa() {
  const [todosLosIngredientes, setTodosLosIngredientes] = useState([]);
  const [recetaObjetivo, setRecetaObjetivo] = useState([]);
  const [miHamburguesa, setMiHamburguesa] = useState([]);
  const [filtroSeccion, setFiltroSeccion] = useState('todos');

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [tiempo, setTiempo] = useState(60);
  const [puntaje, setPuntaje] = useState(350);
  const [pausado, setPausado] = useState(false);

  // Obtener ingredientes y pedido aleatorio
  const iniciarJuego = async () => {
    setCargando(true);
    setError('');
    setMiHamburguesa([]);
    setTiempo(1000000);
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
    } catch (error) {
      console.error('Error al conectar con el backend:', error);
      setError(
        'No se pudo conectar con el servidor. Comprobá que el backend esté funcionando.'
      );
    } finally {
      setCargando(false);
    }
  };

  // Cargar el primer pedido
  useEffect(() => {
    iniciarJuego();
  }, []);

  // Cronómetro
  useEffect(() => {
    if (cargando || pausado || tiempo <= 0 || error) {
      return;
    }

    const intervalo = setInterval(() => {
      setTiempo((anterior) => Math.max(0, anterior - 1));
    }, 1000);

    return () => clearInterval(intervalo);
  }, [cargando, pausado, tiempo, error]);

  // Agregar un ingrediente arriba del anterior
  const agregarIngrediente = (ingrediente) => {
    if (pausado || tiempo <= 0 || cargando || error) {
      return;
    }

    setMiHamburguesa((anterior) => [...anterior, ingrediente]);
  };

  // Eliminar el último ingrediente agregado
  const deshacer = () => {
    setMiHamburguesa((anterior) => anterior.slice(0, -1));
  };

  // Verificar el pedido
  const verificar = () => {
    if (tiempo <= 0 || pausado || cargando || error) {
      return;
    }

    if (miHamburguesa.length !== recetaObjetivo.length) {
      alert('¡La cantidad de ingredientes no coincide!');
      return;
    }

    const esCorrecta = miHamburguesa.every(
      (ingrediente, indice) =>
        ingrediente.id === recetaObjetivo[indice].id
    );

    if (esCorrecta) {
      setPuntaje((anterior) => anterior + 100);
      alert('¡Pedido correcto! Ganaste 100 puntos.');
      iniciarJuego();
    } else {
      alert('El pedido no coincide. ¡Probá de nuevo!');
    }
  };

  // Filtrar ingredientes por categoría
  const ingredientesFiltrados =
    filtroSeccion === 'todos'
      ? todosLosIngredientes
      : todosLosIngredientes.filter(
          (ingrediente) => ingrediente.seccion === filtroSeccion
        );

  const formatearTiempo = (segundos) => {
    const minutos = Math.floor(segundos / 60);
    const resto = segundos % 60;

    return `${String(minutos).padStart(2, '0')}:${String(resto).padStart(2, '0')}`;
  };

  if (cargando) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-amber-50">
        <p className="text-xl font-bold text-amber-900">
          Preparando la cocina...
        </p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex flex-col gap-4 items-center justify-center bg-amber-50 p-6">
        <p className="text-center text-red-700">{error}</p>
        <button
          onClick={iniciarJuego}
          className="rounded-xl bg-amber-800 px-6 py-3 font-bold text-white"
        >
          Reintentar
        </button>
      </main>
    );
  }

  return (
  
    <main className="min-h-screen bg-[#eee9e2] p-3 sm:p-6 font-sans" style={{backgroundImage: "url(cocina.png)", width:1600, height: 800}}>
      <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl bg-[#fffaf1] shadow-xl">

        {/* Barra superior }
        <header className="flex flex-wrap items-center justify-between gap-3 bg-[#fffaf1] p-4">
          <div className="flex items-center gap-2 font-extrabold text-[#692d20]">
            <span className="text-2xl">◷</span>
            <span className="text-xl">{formatearTiempo(tiempo)}</span>
          </div>

          <div className="flex items-center gap-2 font-extrabold text-amber-900">
            <span className="text-2xl">★</span>
            <span className="text-xl">{puntaje}</span>
          </div>

          <button
            onClick={() => setPausado(!pausado)}
            disabled={tiempo <= 0}
            className="rounded-full border-2 border-[#54251c] bg-[#713629] px-4 py-2 text-sm font-bold text-white hover:bg-[#54251c] disabled:opacity-50"
          >
            {pausado ? 'Continuar' : 'Pausar'}
          </button>

          <button
            onClick={iniciarJuego}
            className="rounded-full bg-amber-200 px-4 py-2 text-sm font-bold text-amber-950 hover:bg-amber-300"
          >
            Reiniciar
          </button>
        </header>

        {/* Pedido del cliente/}
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
                className="object-contain"
                style={{
                  width: '100px',
                  height: '50px',
                }}
              />
            ))}
          </div>
        </section>

        {/* Zona de armado /}
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
                      width:
                        ingrediente.nombre === 'pan abajo' || ingrediente.nombre === 'pan arriba'? '160px': 
                        ingrediente.nombre === 'paty' || ingrediente.nombre === 'pollo' || ingrediente.nombre === 'veggie'? '150px': '140px',
                      
                      height: 'auto', 
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Botones de ingredientes }
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
                 style={{
                    width: '60px',
                    height: '60px',
                    objectFit: 'contain',
                  }}
                />
                <span className="mt-1 text-center text-sm font-bold text-[#54251c]">
                  {ingrediente.nombre}
                </span>
              </button>
            ))}
          </div>

          {/* Botones de acción }
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={deshacer}
              disabled={miHamburguesa.length === 0 || pausado || tiempo <= 0}
              className="flex-1 rounded-xl border-2 border-[#54251c] bg-[#713629] px-4 py-3 font-extrabold text-white hover:bg-[#54251c] disabled:opacity-50"
            >
              ↶ DESHACER
            </button>

            <button
              onClick={verificar}
              disabled={pausado || tiempo <= 0}
              className="flex-1 rounded-xl border-2 border-green-900 bg-green-700 px-4 py-3 font-extrabold text-white hover:bg-green-800 disabled:opacity-50"
            >
              ✓ ENTREGAR
            </button>
          </div>

          {tiempo === 0 && (
            <p className="mt-4 text-center font-extrabold text-red-700">
              ¡Se acabó el tiempo! Reiniciá para jugar otra vez.
            </p>
          )}
        </section>
      </div>
    </main>
  );
 //......
  
}*/
