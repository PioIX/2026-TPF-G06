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

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import './partidas.css';

const API_URL = 'http://localhost:4000/api';

// Tiempo de cada pedido (lo dejé como lo tenías; ponelo en 60 para la versión final)
const TIEMPO_PARTIDA = 1000000;

// Mientras no exista la página de la parrilla, true = al soltar una carne en la
// parrilla se agrega directo a la hamburguesa (para poder probar todo el flujo).
// Cuando tengas la página, ponelo en false y creá la ruta RUTA_PARRILLA.
const MODO_PRUEBA_PARRILLA = true;
const RUTA_PARRILLA = '/parrilla';

// true = dibuja un recuadro verde sobre cada bandeja con su nombre,
// para ajustar las posiciones de BANDEJAS si no coinciden con el fondo.
const MOSTRAR_ZONAS = false;

/* =========================================================
   UTILIDADES
   ========================================================= */

const normalizar = (texto = '') =>
  String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]/g, ' ')
    .trim();

// Identifica a un ingrediente de forma segura. Se usa el NOMBRE (es lo que
// coincide entre /orden-aleatoria y /ingredientes). Antes se comparaba por
// "id" y, si el backend no devolvía ese campo, todos eran "undefined" y
// cualquier ingrediente contaba como correcto.
const clave = (ing) =>
  normalizar(ing?.nombre) || String(ing?.id ?? ing?.id_ingrediente ?? ing?.tipo ?? '');

// TODAS las carnes van a la parrilla
const NOMBRES_CARNE = ['paty', 'pollo', 'veggie'];
const esCarne = (ing) =>
  ing?.seccion === 'carnes' || NOMBRES_CARNE.includes(normalizar(ing?.nombre));

/* ---------------------------------------------------------
   Bandejas del fondo (cocina.png). Posiciones en % del escenario.
   "claves": palabras que identifican al ingrediente por su nombre
   (un array dentro de claves = deben estar todas las palabras).
   "seccion": si no se encuentra por nombre, se usa la sección del backend.
   --------------------------------------------------------- */
const FILA1 = { top: 79.9, height: 8.9 };
const FILA2 = { top: 89.8, height: 6.4 };

const BANDEJAS = [
  { id: 'pan-arriba', claves: ['pan arriba'], seccion: 'arriba', left: 0.5, top: 79, width: 11, height: 7.5 },
  { id: 'pan-abajo', claves: ['pan abajo'], seccion: 'abajo', left: 0.3, top: 86.6, width: 11, height: 9.4 },
  { id: 'paty', claves: ['paty', 'patty', 'carne'], seccion: 'carnes', left: 11.5, top: 80.2, width: 5.6, height: 14.4 },
  { id: 'pollo', claves: ['pollo'], seccion: 'carnes', left: 18.7, top: 80.2, width: 5.6, height: 6.8 },
  { id: 'veggie', claves: ['veggie', 'vegana', 'vegano', 'vegetar'], seccion: 'carnes', left: 17.4, top: 87.2, width: 6.2, height: 7.4 },
  { id: 'lechuga', claves: ['lechuga'], left: 25.4, width: 8.1, ...FILA1 },
  { id: 'tomate', claves: ['tomate'], left: 34, width: 7.6, ...FILA1 },
  { id: 'cebolla', claves: ['cebolla'], left: 41.9, width: 7.8, ...FILA1 },
  { id: 'pepino', claves: ['pepino'], left: 50, width: 8, ...FILA1 },
  { id: 'pickles', claves: ['pickle', 'pepinillo', 'encurtido'], left: 58.3, width: 7.9, ...FILA1 },
  { id: 'aceituna-verde', claves: [['aceituna', 'verde'], ['oliva', 'verde'], 'verde'], left: 66.7, width: 7.2, ...FILA1 },
  { id: 'aceituna-negra', claves: [['aceituna', 'negra'], ['oliva', 'negra'], 'negra'], left: 74.2, width: 6.6, ...FILA1 },
  { id: 'bacon', claves: ['bacon', 'panceta', 'tocino', 'beicon'], left: 81.3, width: 8.8, ...FILA1 },
  { id: 'huevo', claves: ['huevo'], left: 90.4, width: 7.8, ...FILA1 },
  { id: 'cheddar', claves: ['cheddar', 'chedar', 'amarillo'], seccion: 'quesos', left: 25.3, width: 10, ...FILA2 },
  { id: 'mozzarella', claves: ['mozz', 'mozar', 'mozat', 'muzza', 'blanco'], seccion: 'quesos', left: 35.8, width: 11.2, ...FILA2 },
  { id: 'mostaza', claves: ['mostaza'], left: 47.9, width: 8.7, ...FILA2 },
  { id: 'ketchup', claves: ['ketchup', 'keptchup', 'kechup', 'catsup'], left: 57.2, width: 8.7, ...FILA2 },
  { id: 'mayonesa', claves: ['mayo'], left: 66.5, width: 9, ...FILA2 },
  { id: 'papas', claves: ['papa', 'fritas'], left: 76.1, width: 23.2, ...FILA2 },
];

const coincide = (nombre, claves) =>
  claves.some((k) =>
    Array.isArray(k) ? k.every((t) => nombre.includes(t)) : nombre.includes(k)
  );

// Une cada bandeja del fondo con el ingrediente que viene del backend
const asignarBandejas = (ingredientes) => {
  const libres = [...ingredientes];
  const asignadas = [];
  const sinEncontrar = [];

  const tomar = (condicion) => {
    const i = libres.findIndex(condicion);
    return i >= 0 ? libres.splice(i, 1)[0] : null;
  };

  BANDEJAS.forEach((bandeja) => {
    const ingrediente = tomar((x) => coincide(normalizar(x.nombre), bandeja.claves));
    if (ingrediente) asignadas.push({ bandeja, ingrediente });
    else sinEncontrar.push(bandeja);
  });

  // Segunda pasada: por sección (por si el nombre del backend es distinto)
  sinEncontrar.forEach((bandeja) => {
    if (!bandeja.seccion) return;
    const ingrediente = tomar((x) => x.seccion === bandeja.seccion);
    if (ingrediente) asignadas.push({ bandeja, ingrediente });
  });

  return { asignadas, sinBandeja: libres };
};

/* ---------------------------------------------------------
   Tamaño y "grosor" de cada ingrediente dentro de la hamburguesa.
   ancho  = ancho visible en % del escenario
   solape = cuánto se mete en el ingrediente de abajo (0 a 1)
   --------------------------------------------------------- */
const perfil = (ing) => {
  const n = normalizar(ing?.nombre);
  const es = (...palabras) => palabras.some((p) => n.includes(p));

  if (/(^|\s)pan(\s|$)/.test(n)) {
    const arriba = es('arriba') || ing?.seccion === 'arriba';
    return { ancho: 10.4, solape: arriba ? 0.04 : 0.1, pan: true };
  }
  if (esCarne(ing)) return { ancho: 9.4, solape: 0.18 };
  if (es('chedar', 'cheddar', 'queso', 'mozz', 'mozat', 'muzza')) return { ancho: 9.8, solape: 0.3 };
  if (es('lechuga')) return { ancho: 10.4, solape: 0.5 };
  if (es('tomate')) return { ancho: 8.8, solape: 0.35 };
  if (es('cebolla')) return { ancho: 8.4, solape: 0.35 };
  if (es('pepino', 'pickle', 'pepinillo')) return { ancho: 8.2, solape: 0.35 };
  if (es('bacon', 'panceta', 'tocino')) return { ancho: 9.2, solape: 0.3 };
  if (es('huevo')) return { ancho: 8.8, solape: 0.3 };
  if (es('aceituna', 'oliva')) return { ancho: 7.8, solape: 0.35 };
  if (es('ketchup', 'keptchup', 'mayo', 'mostaza')) return { ancho: 8.6, solape: 0.4 };
  return { ancho: 8.8, solape: 0.3 };
};

/* ---------------------------------------------------------
   Recorta los bordes transparentes de cada PNG, así las capas
   quedan pegadas entre sí sin huecos raros.
   --------------------------------------------------------- */
const recortarImagen = (src) =>
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
        const { data } = ctx.getImageData(0, 0, w, h);

        let minX = w, minY = h, maxX = -1, maxY = -1;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            if (data[(y * w + x) * 4 + 3] > 12) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        if (maxX < 0) return resolve({ url: src, w, h });

        const cw = maxX - minX + 1;
        const ch = maxY - minY + 1;
        const salida = document.createElement('canvas');
        salida.width = cw;
        salida.height = ch;
        salida.getContext('2d').drawImage(lienzo, minX, minY, cw, ch, 0, 0, cw, ch);

        resolve({ url: salida.toDataURL('image/png'), w: cw, h: ch });
      } catch (e) {
        resolve({ url: src, w: w || 1, h: h || 1 });
      }
    };

    img.onerror = () => resolve({ url: src, w: 1, h: 1 });
    img.src = src;
  });

/* =========================================================
   COMPONENTE
   ========================================================= */

export default function JuegoHamburguesa() {
  const router = useRouter();

  const [todosLosIngredientes, setTodosLosIngredientes] = useState([]);
  const [recetaObjetivo, setRecetaObjetivo] = useState([]);
  const [miHamburguesa, setMiHamburguesa] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [tiempo, setTiempo] = useState(60);
  const [puntaje, setPuntaje] = useState(350);
  const [pausado, setPausado] = useState(false);

  // Imágenes recortadas: { '/lechuga.png': { url, w, h } }
  const [recortes, setRecortes] = useState({});
  const [imagenesListas, setImagenesListas] = useState(false);

  // --- Arrastre ---
  const [mano, setMano] = useState(null); // ingrediente que sigue al cursor
  const [anchoMano, setAnchoMano] = useState(140);
  const [zonaActiva, setZonaActiva] = useState(null); // 'plato' | 'parrilla' | null
  const [aviso, setAviso] = useState('');

  const escenarioRef = useRef(null);
  const platoRef = useRef(null);
  const parrillaRef = useRef(null);
  const flotanteRef = useRef(null);
  const manoRef = useRef(null);
  const posRef = useRef({ x: 0, y: 0 });
  const inicioRef = useRef({ x: 0, y: 0 });
  const seMovioRef = useRef(false);
  const modoClickRef = useRef(false);
  const soltarRef = useRef(() => {});
  const avisoTimerRef = useRef(null);

  const activo = !(pausado || tiempo <= 0 || cargando || error);
  const activoRef = useRef(activo);
  activoRef.current = activo;

  const urlImg = (ing) => recortes[ing?.tipo]?.url ?? ing?.tipo;

  const mostrarAviso = (texto) => {
    setAviso(texto);
    clearTimeout(avisoTimerRef.current);
    avisoTimerRef.current = setTimeout(() => setAviso(''), 2200);
  };

  const cancelarMano = () => {
    manoRef.current = null;
    modoClickRef.current = false;
    setMano(null);
    setZonaActiva(null);
  };

  // Obtener ingredientes y pedido aleatorio
  const iniciarJuego = async () => {
    setCargando(true);
    setError('');
    setMiHamburguesa([]);
    setTiempo(TIEMPO_PARTIDA);
    setPausado(false);
    cancelarMano();

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
    return () => clearTimeout(avisoTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recortar las imágenes de los ingredientes (una sola vez por imagen)
  useEffect(() => {
    const fuentes = [
      ...new Set(
        [...todosLosIngredientes, ...recetaObjetivo]
          .map((i) => i.tipo)
          .filter(Boolean)
      ),
    ];

    if (fuentes.length === 0) {
      if (!cargando) setImagenesListas(true);
      return;
    }

    const faltan = fuentes.filter((s) => !recortes[s]);
    if (faltan.length === 0) {
      setImagenesListas(true);
      return;
    }

    let cancelado = false;
    Promise.all(faltan.map(recortarImagen)).then((resultados) => {
      if (cancelado) return;
      setRecortes((anterior) => {
        const nuevo = { ...anterior };
        faltan.forEach((s, i) => {
          nuevo[s] = resultados[i];
        });
        return nuevo;
      });
      setImagenesListas(true);
    });

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todosLosIngredientes, recetaObjetivo, cargando]);

  // Avisar por consola si algún ingrediente no tiene bandeja en el fondo
  useEffect(() => {
    if (todosLosIngredientes.length === 0) return;
    if (todosLosIngredientes.some((i) => i.id === undefined)) {
      console.warn(
        'Los ingredientes no tienen campo "id". Campos recibidos:',
        Object.keys(todosLosIngredientes[0])
      );
    }
    const { sinBandeja } = asignarBandejas(todosLosIngredientes);
    if (sinBandeja.length > 0) {
      console.warn(
        'Ingredientes sin bandeja en el fondo (aparecen en el estante extra):',
        sinBandeja.map((i) => i.nombre)
      );
    }
  }, [todosLosIngredientes]);

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

  // Si se pausa o se acaba el tiempo con un ingrediente en la mano, se suelta
  useEffect(() => {
    if (!activo && manoRef.current) cancelarMano();
  }, [activo]);

  /* ---------- LÓGICA DE ARRASTRE ---------- */

  const zonaEn = (x, y) => {
    const dentro = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    };
    if (dentro(platoRef.current)) return 'plato';
    if (dentro(parrillaRef.current)) return 'parrilla';
    return null;
  };

  const posicionarFlotante = () => {
    const el = flotanteRef.current;
    if (!el) return;
    const { x, y } = posRef.current;
    el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(-6deg)`;
  };

  const mandarAParrilla = (ingrediente) => {
    if (MODO_PRUEBA_PARRILLA) {
      setMiHamburguesa((anterior) => [...anterior, ingrediente]);
      mostrarAviso('🔥 Carne cocinada (modo prueba)');
      return;
    }

    // Guardamos la partida para retomarla al volver de la parrilla
    sessionStorage.setItem(
      'partida',
      JSON.stringify({
        miHamburguesa,
        recetaObjetivo,
        tiempo,
        puntaje,
        ingredienteACocinar: ingrediente,
      })
    );
    router.push(RUTA_PARRILLA);
  };

  // Se ejecuta cuando soltás el ingrediente
  const soltar = (x, y) => {
    const ingrediente = manoRef.current;
    cancelarMano();
    if (!ingrediente || !activoRef.current) return;

    const zona = zonaEn(x, y);
    const vaALaParrilla = esCarne(ingrediente);

    if (zona === 'plato') {
      if (vaALaParrilla) {
        mostrarAviso('Las carnes primero se cocinan en la parrilla 🔥');
      } else {
        setMiHamburguesa((anterior) => [...anterior, ingrediente]);
      }
    } else if (zona === 'parrilla') {
      if (vaALaParrilla) {
        mandarAParrilla(ingrediente);
      } else {
        mostrarAviso('Eso no va en la parrilla');
      }
    }
    // Si se soltó en cualquier otro lado, simplemente vuelve a su lugar
  };
  soltarRef.current = soltar;

  const iniciarArrastre = (e, ingrediente) => {
    if (!activoRef.current) return;
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();

    // Click sobre la misma bandeja con el ingrediente en la mano: lo devuelve
    if (modoClickRef.current && manoRef.current && clave(manoRef.current) === clave(ingrediente)) {
      cancelarMano();
      return;
    }

    const anchoEscenario =
      escenarioRef.current?.getBoundingClientRect().width ?? 1600;

    posRef.current = { x: e.clientX, y: e.clientY };
    inicioRef.current = { x: e.clientX, y: e.clientY };
    seMovioRef.current = false;
    modoClickRef.current = false;
    manoRef.current = ingrediente;

    setAnchoMano((perfil(ingrediente).ancho / 100) * anchoEscenario);
    setZonaActiva(null);
    setMano(ingrediente);
  };

  // Mientras hay un ingrediente en la mano escuchamos el mouse/dedo
  useEffect(() => {
    if (!mano) return;

    const mover = (e) => {
      posRef.current = { x: e.clientX, y: e.clientY };
      posicionarFlotante();

      const distancia = Math.hypot(
        e.clientX - inicioRef.current.x,
        e.clientY - inicioRef.current.y
      );
      if (distancia > 6) seMovioRef.current = true;

      setZonaActiva(zonaEn(e.clientX, e.clientY));
    };

    const levantar = (e) => {
      if (!manoRef.current) return;
      if (seMovioRef.current) {
        // Arrastraste y soltaste
        soltarRef.current(e.clientX, e.clientY);
      } else {
        // Fue un click simple: el ingrediente queda pegado al cursor
        // y se suelta con el próximo click
        modoClickRef.current = true;
      }
    };

    const presionar = (e) => {
      if (!manoRef.current || !modoClickRef.current) return;
      if (e.target.closest?.('[data-ingrediente]')) return; // elegir otro
      soltarRef.current(e.clientX, e.clientY);
    };

    const teclas = (e) => {
      if (e.key === 'Escape') cancelarMano();
    };

    const menu = (e) => {
      e.preventDefault();
      cancelarMano();
    };

    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', levantar);
    window.addEventListener('pointerdown', presionar);
    window.addEventListener('keydown', teclas);
    window.addEventListener('contextmenu', menu);
    document.body.style.cursor = 'grabbing';

    return () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', levantar);
      window.removeEventListener('pointerdown', presionar);
      window.removeEventListener('keydown', teclas);
      window.removeEventListener('contextmenu', menu);
      document.body.style.cursor = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mano]);

  /* ---------- ACCIONES ---------- */

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
      (ingrediente, indice) => clave(ingrediente) === clave(recetaObjetivo[indice])
    );

    if (esCorrecta) {
      setPuntaje((anterior) => anterior + 100);
      alert('¡Pedido correcto! Ganaste 100 puntos.');
      iniciarJuego();
    } else {
      alert('El pedido no coincide. ¡Probá de nuevo!');
    }
  };

  const formatearTiempo = (segundos) => {
    const minutos = Math.floor(segundos / 60);
    const resto = segundos % 60;

    return `${String(minutos).padStart(2, '0')}:${String(resto).padStart(2, '0')}`;
  };

  /* ---------- PROGRESO DEL TICKET ---------- */
  // "correctos" = cuántos ingredientes seguidos desde abajo coinciden con el pedido
  let correctos = 0;
  while (
    correctos < miHamburguesa.length &&
    correctos < recetaObjetivo.length &&
    clave(miHamburguesa[correctos]) === clave(recetaObjetivo[correctos])
  ) {
    correctos++;
  }
  const hayError = miHamburguesa.length > correctos;
  const pedidoCompleto =
    !hayError &&
    recetaObjetivo.length > 0 &&
    correctos === recetaObjetivo.length;

  const sostieneParrilla = mano && esCarne(mano);
  const sostienePlato = mano && !esCarne(mano);

  /* ---------- HAMBURGUESA: posición de cada capa ---------- */
  // Cada ingrediente se apoya sobre el anterior, metiéndose un poco
  // (solape) como en una hamburguesa real.
  let acumulado = 0;
  const capas = miHamburguesa.map((ingrediente, indice) => {
    const p = perfil(ingrediente);
    const r = recortes[ingrediente.tipo];
    const proporcion = r ? r.h / r.w : 0.3;
    const alto = p.ancho * proporcion;
    const desvio = p.pan ? 0 : (((indice * 37) % 5) - 2) * 0.15; // leve desorden natural

    const capa = {
      ingrediente,
      url: r?.url ?? ingrediente.tipo,
      ancho: p.ancho,
      x: desvio,
      y: acumulado,
      z: indice + 1,
    };

    acumulado += alto * (1 - p.solape);
    return capa;
  });

  /* ---------- BANDEJAS ---------- */
  const { asignadas, sinBandeja } = asignarBandejas(todosLosIngredientes);

  /* ---------- PANTALLAS DE CARGA / ERROR ---------- */
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

  if (cargando || !imagenesListas) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-amber-50">
        <p className="text-xl font-bold text-amber-900">
          Preparando la cocina...
        </p>
      </main>
    );
  }

  const botonIngrediente = (ingrediente, estilo, clase = '') => (
    <button
      key={clave(ingrediente)}
      type="button"
      data-ingrediente
      data-nombre={ingrediente.nombre}
      title={ingrediente.nombre}
      onPointerDown={(e) => iniciarArrastre(e, ingrediente)}
      className={`bandeja ${clase} ${!activo ? 'deshabilitado' : ''}`}
      style={estilo}
    />
  );

  return (
    <main className="juego">
      <div
        className={`escenario ${mano ? 'con-mano' : ''} ${
          MOSTRAR_ZONAS ? 'debug' : ''
        }`}
        ref={escenarioRef}
      >
        {/* ---------- TICKET DEL PEDIDO ---------- */}
        <aside className="ticket">
          <h2 className="ticket-titulo">PEDIDO</h2>
          <p className="ticket-progreso">
            {Math.min(correctos, recetaObjetivo.length)}/{recetaObjetivo.length}{' '}
            listos
          </p>

          <ul className="ticket-lista">
            {recetaObjetivo.map((ingrediente, indice) => {
              const hecho = indice < correctos;
              const fallo = indice === correctos && hayError;
              const siguiente = indice === correctos && !hayError;

              return (
                <li
                  key={`${ingrediente.id}-${indice}`}
                  className={`ticket-item ${hecho ? 'hecho' : ''} ${
                    fallo ? 'fallo' : ''
                  } ${siguiente ? 'siguiente' : ''}`}
                >
                  <img
                    src={urlImg(ingrediente)}
                    alt=""
                    draggable={false}
                    className="ticket-icono"
                  />
                  <span className="ticket-nombre">{ingrediente.nombre}</span>
                  <span className="ticket-marca">
                    {hecho ? '✓' : fallo ? '✗' : ''}
                  </span>
                </li>
              );
            })}
          </ul>

          {hayError && <p className="ticket-nota error">¡Ese no va! Usá DESHACER</p>}
          {pedidoCompleto && <p className="ticket-nota ok">¡Listo! Entregalo 👉</p>}
        </aside>

        {/* ---------- BARRA SUPERIOR ---------- */}
        <header className="hud">
          <div className="hud-dato">
            <span>◷</span>
            <strong>{formatearTiempo(tiempo)}</strong>
          </div>
          <div className="hud-dato">
            <span>★</span>
            <strong>{puntaje}</strong>
          </div>
          <button
            onClick={() => setPausado(!pausado)}
            disabled={tiempo <= 0}
            className="hud-boton"
          >
            {pausado ? 'Continuar' : 'Pausar'}
          </button>
          <button onClick={iniciarJuego} className="hud-boton claro">
            Reiniciar
          </button>
        </header>

        {/* ---------- ZONAS DE SOLTADO ---------- */}
        <div
          ref={parrillaRef}
          className={`zona-parrilla ${sostieneParrilla ? 'visible' : ''} ${
            sostieneParrilla && zonaActiva === 'parrilla' ? 'activa' : ''
          }`}
        >
          {sostieneParrilla && <span>🔥 Soltá la carne en la parrilla</span>}
        </div>

        <div
          ref={platoRef}
          className={`zona-plato ${sostienePlato ? 'visible' : ''} ${
            sostienePlato && zonaActiva === 'plato' ? 'activa' : ''
          }`}
        >
          {miHamburguesa.length === 0 && !mano && (
            <p className="mensaje-vacio">
              Tocá un ingrediente y arrastralo hasta el plato
            </p>
          )}
        </div>

        {/* ---------- HAMBURGUESA EN EL PLATO ---------- */}
        <div className="pila">
          {capas.map((capa, indice) => (
            <div
              key={`${capa.ingrediente.id}-${indice}`}
              className="capa"
              style={{
                left: `${capa.x}cqw`,
                bottom: `${capa.y}cqw`,
                width: `${capa.ancho}cqw`,
                zIndex: capa.z,
              }}
            >
              <img
                src={capa.url}
                alt={capa.ingrediente.nombre}
                title={capa.ingrediente.nombre}
                draggable={false}
                className="imagen-ingrediente"
              />
            </div>
          ))}
        </div>

        {/* ---------- BANDEJAS (zonas clickeables sobre el fondo) ---------- */}
        {asignadas.map(({ bandeja, ingrediente }) =>
          botonIngrediente(ingrediente, {
            left: `${bandeja.left}%`,
            top: `${bandeja.top}%`,
            width: `${bandeja.width}%`,
            height: `${bandeja.height}%`,
          })
        )}

        {/* Ingredientes del backend que no tienen bandeja dibujada */}
        {sinBandeja.length > 0 && (
          <div className="estante-extra">
            <p>Más ingredientes</p>
            <div>
              {sinBandeja.map((ingrediente) => (
                <button
                  key={clave(ingrediente)}
                  type="button"
                  data-ingrediente
                  onPointerDown={(e) => iniciarArrastre(e, ingrediente)}
                  className={`extra-item ${!activo ? 'deshabilitado' : ''}`}
                  title={ingrediente.nombre}
                >
                  <img src={urlImg(ingrediente)} alt={ingrediente.nombre} draggable={false} />
                  <span>{ingrediente.nombre}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ---------- BOTONES DE ACCIÓN ---------- */}
        <div className="acciones">
          <button
            onClick={deshacer}
            disabled={miHamburguesa.length === 0 || pausado || tiempo <= 0}
            className="accion deshacer"
          >
            ↶ DESHACER
          </button>
          <button
            onClick={verificar}
            disabled={pausado || tiempo <= 0}
            className="accion entregar"
          >
            ✓ ENTREGAR
          </button>
        </div>

        {/* ---------- AVISOS ---------- */}
        {aviso && <div className="aviso">{aviso}</div>}
        {pausado && <div className="cartel-central">⏸ PAUSA</div>}
        {tiempo === 0 && (
          <div className="cartel-central rojo">
            ¡Se acabó el tiempo! Reiniciá para jugar otra vez.
          </div>
        )}
      </div>

      {/* ---------- INGREDIENTE PEGADO AL CURSOR ---------- */}
      {mano && (
        <img
          ref={flotanteRef}
          src={urlImg(mano)}
          alt=""
          draggable={false}
          className="ingrediente-flotante"
          style={{
            width: `${anchoMano}px`,
            transform: `translate(${posRef.current.x}px, ${posRef.current.y}px) translate(-50%, -50%) rotate(-6deg)`,
          }}
        />
      )}
    </main>
  );
}