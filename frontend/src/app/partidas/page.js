'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import './partidas.css';

const API_URL = 'http://localhost:4000/api';

// Tiempo de cada pedido en segundos (ponelo en 60 para la versión final)
const TIEMPO_PARTIDA = 1000000;

// false = al soltar una carne en la parrilla se va a la página /parrilla.
// true  = (solo para pruebas) la carne se agrega directo a la hamburguesa.
const MODO_PRUEBA_PARRILLA = false;
const RUTA_PARRILLA = '/parrilla';

// Milkshakes: al tocar la máquina del fondo se va a otra página.
// true = al tocar la máquina se da el milkshake por hecho (para probar).
const MODO_PRUEBA_MILKSHAKE = false;
const RUTA_MILKSHAKE = '/milkshakes';
const PROBABILIDAD_MILKSHAKE = 0.6; // 1 = todos los pedidos piden milkshake
const MAX_MILKSHAKES = 2; // cantidad máxima de milkshakes por pedido

// Freidora: al tocar la freidora del fondo se va a /freidora.
// true = al tocar la freidora se da lo frito por hecho (para probar).
const MODO_PRUEBA_FREIDORA = false;
const RUTA_FREIDORA = '/freidora';
const PROBABILIDAD_FRITOS = 0.5; // 1 = todos los pedidos piden algo de la freidora
const MAX_FRITOS = 2; // cantidad máxima de fritos por pedido

// Sabores que puede pedir un cliente. El "id" es el que viaja a la página
// de milkshakes dentro de la partida guardada (saboresMilkshake).
// "imagen" es el milkshake terminado que aparece en la bandeja (están en /public).
const SABORES_MILKSHAKE = [
  { id: 'vainilla', nombre: 'Vainilla', emoji: '🍦', imagen: '/vainilla.png' },
  { id: 'chocolate', nombre: 'Chocolate', emoji: '🍫', imagen: '/chocolate.png' },
  { id: 'cookies-cream', nombre: 'Cookies & Cream', emoji: '🍪', imagen: '/cookies&cream.png' },
  { id: 'frutilla', nombre: 'Frutilla', emoji: '🍓', imagen: '/frutilla.png' },
];

const saborPorId = (id) =>
  SABORES_MILKSHAKE.find((s) => s.id === id) ?? SABORES_MILKSHAKE[0];

// Cosas que puede pedir un cliente de la freidora. El "id" viaja a la página
// /freidora dentro de la partida guardada (fritosPedidos). Editá la lista a gusto.
const FRITOS = [
  { id: 'papas', nombre: 'Papas fritas', emoji: '🍟' },
];

const fritoPorId = (id) => FRITOS.find((f) => f.id === id) ?? FRITOS[0];

// Zona clickeable de la máquina de milkshakes (en % del escenario)
const MAQUINA_MILKSHAKE = { left: 68.3, top: 25, width: 10.7, height: 21 };

// Bandeja donde aparecen los milkshakes ya preparados (a la derecha del plato).
// Poné MOSTRAR_ZONAS en true para ver un recuadro rosa con el lugar donde
// quedan, y movelo con estos números hasta que apoyen sobre la bandeja:
//   x          = centro de los milkshakes, en % del ANCHO  (más alto = más a la derecha)
//   base       = dónde apoya la base del vaso, en % del ALTO medido desde abajo
//                (más alto = más arriba; el plato está en el mismo nivel que la hamburguesa)
//   ancho      = ancho de cada milkshake (en cqw, 1 = 1% del ancho de la escena)
//   separacion         = distancia HORIZONTAL entre milkshakes (en cqw; 0 = uno justo detrás del otro)
//   separacionVertical = distancia VERTICAL entre milkshakes (en cqw): el primero queda
//                        más atrás (arriba) y el último más adelante (abajo), tapándolo un poco
const BANDEJA_MILKSHAKE = {
  x: 61.2,
  base: 29.5,
  ancho: 7,
  separacion: 0,
  separacionVertical: 3.6,
};
const PROPORCION_MILKSHAKE = 1199 / 600; // alto / ancho del PNG del milkshake

// Zona clickeable de la freidora (en % del escenario).
// OJO: son posiciones aproximadas. Poné MOSTRAR_ZONAS en true para ver el
// recuadro y movelo (left / top / width / height) hasta que quede sobre la freidora.
const FREIDORA = { left: 57, top: 25, width: 10.7, height: 21 };

// true = dibuja un recuadro verde sobre cada bandeja con su nombre,
// para ajustar las posiciones de BANDEJAS si no coinciden con el fondo.
const MOSTRAR_ZONAS = false;

// Cuánto más pegados quedan los ingredientes en la hamburguesa.
// 0 = como estaba, 0.12 = un poco más pegados, 0.25 = bastante más pegados.
// (Para ajustar un ingrediente en particular, cambiá su "solape" en perfil()).
const PEGADO_EXTRA = 0.55;

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

// Por si el backend mandara un milkshake dentro de la receta o de los
// ingredientes: un milkshake nunca debe mezclarse con la hamburguesa.
const esMilkshake = (ing) => /milkshake|batido/.test(normalizar(ing?.nombre));

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

const esPan = (ing) => /(^|\s)pan(\s|$)/.test(normalizar(ing?.nombre));

// Todo pedido lleva al menos una carne. Si el backend mandó un pedido sin
// carne, se agrega una al azar justo arriba del pan de abajo.
const asegurarCarne = (orden, ingredientes) => {
  const carnes = ingredientes.filter(esCarne);
  const yaTiene = orden.some(
    (o) => esCarne(o) || carnes.some((c) => clave(c) === clave(o))
  );
  if (yaTiene || carnes.length === 0) return orden;

  const carne = carnes[Math.floor(Math.random() * carnes.length)];
  const iPanAbajo = orden.findIndex(
    (o) => o.seccion === 'abajo' || (esPan(o) && !normalizar(o.nombre).includes('arriba'))
  );
  const nueva = [...orden];
  nueva.splice(iPanAbajo >= 0 ? iPanAbajo + 1 : 0, 0, carne);
  return nueva;
};

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
            (más alto = más pegado)
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

// Partida guardada al salir hacia la parrilla / milkshakes / freidora
const leerPartidaGuardada = () => {
  try {
    const texto = sessionStorage.getItem('partida');
    return texto ? JSON.parse(texto) : null;
  } catch (e) {
    return null;
  }
};

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
  const [tiempo, setTiempo] = useState(TIEMPO_PARTIDA);
  const [puntaje, setPuntaje] = useState(350);
  const [pausado, setPausado] = useState(false);

  // Milkshakes de este pedido: lista de sabores pedidos, ej. ['vainilla', 'frutilla'].
  // La cantidad pedida sale de la longitud de la lista.
  const [saboresMilkshake, setSaboresMilkshake] = useState([]);
  const milkshakesPedidos = saboresMilkshake.length;
  const [milkshakesListos, setMilkshakesListos] = useState(0);

  // Cuántos milkshakes ya estaban en la bandeja antes de ir a la máquina.
  // Esos no repiten la animación; solo aparece el que acabás de preparar.
  const [milkshakesRestaurados, setMilkshakesRestaurados] = useState(0);

  // Fritos de este pedido (freidora): lista de ids, ej. ['papas', 'nuggets'].
  // La cantidad pedida sale de la longitud de la lista.
  const [fritosPedidos, setFritosPedidos] = useState([]);
  const cantidadFritos = fritosPedidos.length;
  const [fritosListos, setFritosListos] = useState(0);

  // Imágenes recortadas: { '/lechuga.png': { url, w, h } }
  const [recortes, setRecortes] = useState({});
  const [imagenesListas, setImagenesListas] = useState(false);

  // --- Arrastre ---
  const [mano, setMano] = useState(null); // ingrediente que sigue al cursor
  const [anchoMano, setAnchoMano] = useState(140);
  const [zonaActiva, setZonaActiva] = useState(null); // 'plato' | 'parrilla' | null
  const [aviso, setAviso] = useState('');

  // Cuántas capas se recuperaron al volver de la parrilla / milkshakes / freidora.
  // Esas no repiten la animación de caída; solo caen las nuevas.
  const [restauradas, setRestauradas] = useState(0);

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

  // Todo lo que hay que recordar al salir hacia otra página
  const partidaActual = (extra = {}) => ({
    miHamburguesa,
    recetaObjetivo,
    tiempo,
    puntaje,
    milkshakesPedidos,
    saboresMilkshake,
    milkshakesListos,
    fritosPedidos,
    fritosListos,
    guardadoEn: Date.now(),
    ...extra,
  });

  // Obtener ingredientes y pedido aleatorio.
  // Si viene una partida guardada (al volver de la parrilla, de los
  // milkshakes o de la freidora) se retoma en vez de empezar un pedido nuevo.
  const iniciarJuego = async (guardada = null) => {
    // OJO: algunos botones llaman a esta función con el evento del click
    const partida =
      guardada && Array.isArray(guardada.recetaObjetivo) ? guardada : null;

    setCargando(true);
    setError('');
    setPausado(false);
    cancelarMano();

    if (!partida) {
      sessionStorage.removeItem('partida');
      setMiHamburguesa([]);
      setRestauradas(0);
      setTiempo(TIEMPO_PARTIDA);
      setMilkshakesListos(0);
      setMilkshakesRestaurados(0);
      setFritosListos(0);
    }

    try {
      const [resIngredientes, resOrden] = await Promise.all([
        fetch(`${API_URL}/ingredientes`),
        partida ? Promise.resolve(null) : fetch(`${API_URL}/orden-aleatoria`),
      ]);

      if (!resIngredientes.ok || (resOrden && !resOrden.ok)) {
        throw new Error('No se pudieron obtener los datos.');
      }

      const ingredientesData = await resIngredientes.json();
      const ordenData = partida ? partida.recetaObjetivo : await resOrden.json();

      if (!Array.isArray(ordenData) || !Array.isArray(ingredientesData)) {
        throw new Error('La respuesta del servidor no es válida.');
      }

      if (partida) {
        // El tiempo siguió corriendo mientras estabas en la otra página
        const transcurrido = Math.floor(
          (Date.now() - (partida.guardadoEn ?? Date.now())) / 1000
        );

        let hamburguesa = Array.isArray(partida.miHamburguesa)
          ? partida.miHamburguesa
          : [];

        // Carne cocinada en la parrilla: se suma a la hamburguesa
        if (partida.resultadoParrilla === 'cocinada' && partida.ingredienteACocinar) {
          hamburguesa = [...hamburguesa, partida.ingredienteACocinar];
        }

        setRecetaObjetivo(ordenData);
        setTodosLosIngredientes(ingredientesData);
        setMiHamburguesa(hamburguesa);
        setRestauradas(
          Array.isArray(partida.miHamburguesa) ? partida.miHamburguesa.length : 0
        );
        setTiempo(Math.max(0, (partida.tiempo ?? TIEMPO_PARTIDA) - transcurrido));
        setPuntaje(partida.puntaje ?? 0);
        setSaboresMilkshake(
          Array.isArray(partida.saboresMilkshake) ? partida.saboresMilkshake : []
        );
        setMilkshakesListos(partida.milkshakesListos ?? 0);
        // "milkshakesAntes" lo guarda la cocina al salir hacia la máquina
        setMilkshakesRestaurados(
          partida.milkshakesAntes ?? partida.milkshakesListos ?? 0
        );
        setFritosPedidos(
          Array.isArray(partida.fritosPedidos) ? partida.fritosPedidos : []
        );
        setFritosListos(partida.fritosListos ?? 0);
        sessionStorage.removeItem('partida');

        if (partida.resultadoParrilla === 'quemada') {
          mostrarAviso('🔥 ¡Se quemó la carne! Agarrá otra y volvé a cocinarla');
        } else if (partida.resultadoParrilla === 'cocinada') {
          mostrarAviso('🍖 ¡Carne en su punto! Ya está en tu hamburguesa');
        } else if (partida.resultadoFreidora === 'quemada') {
          mostrarAviso('🔥 ¡Se quemó lo de la freidora! Volvé a freírlo');
        } else if (partida.resultadoFreidora === 'cocinada') {
          mostrarAviso('🍟 ¡Frito en su punto!');
        }
      } else {
        // Los milkshakes nunca forman parte de la receta de la hamburguesa
        const recetaLimpia = ordenData.filter((o) => !esMilkshake(o));
        const ingredientesLimpios = ingredientesData.filter((i) => !esMilkshake(i));

        setRecetaObjetivo(asegurarCarne(recetaLimpia, ingredientesLimpios));
        setTodosLosIngredientes(ingredientesLimpios);

        // Cada milkshake pide un sabor al azar (puede repetirse)
        const cantidad =
          Math.random() < PROBABILIDAD_MILKSHAKE
            ? 1 + Math.floor(Math.random() * MAX_MILKSHAKES)
            : 0;
        setSaboresMilkshake(
          Array.from(
            { length: cantidad },
            () =>
              SABORES_MILKSHAKE[
                Math.floor(Math.random() * SABORES_MILKSHAKE.length)
              ].id
          )
        );

        // Cada frito de la freidora pide algo al azar (puede repetirse)
        const cantidadFrit =
          Math.random() < PROBABILIDAD_FRITOS
            ? 1 + Math.floor(Math.random() * MAX_FRITOS)
            : 0;
        setFritosPedidos(
          Array.from(
            { length: cantidadFrit },
            () => FRITOS[Math.floor(Math.random() * FRITOS.length)].id
          )
        );
      }
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
    iniciarJuego(leerPartidaGuardada());
    return () => clearTimeout(avisoTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recortar las imágenes de los ingredientes (una sola vez por imagen)
  useEffect(() => {
    const fuentes = [
      ...new Set(
        [...todosLosIngredientes, ...recetaObjetivo, ...miHamburguesa]
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
  }, [todosLosIngredientes, recetaObjetivo, miHamburguesa, cargando]);

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
        'Ingredientes sin bandeja en el fondo:',
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
      JSON.stringify(partidaActual({ ingredienteACocinar: ingrediente }))
    );
    router.push(RUTA_PARRILLA);
  };

  // Tocar la máquina de milkshakes
  const tocarMaquinaMilkshake = () => {
    // Si hay un ingrediente en la mano, este click solo lo suelta
    if (!activoRef.current || manoRef.current) return;

    if (milkshakesPedidos === 0) {
      mostrarAviso('Este pedido no lleva milkshake');
      return;
    }
    if (milkshakesListos >= milkshakesPedidos) {
      mostrarAviso('Ya preparaste todos los milkshakes 🥤');
      return;
    }

    if (MODO_PRUEBA_MILKSHAKE) {
      const sabor = saborPorId(saboresMilkshake[milkshakesListos]);
      setMilkshakesListos((n) => n + 1);
      mostrarAviso(`🥤 Milkshake de ${sabor.nombre} listo (modo prueba)`);
      return;
    }

    // Guardamos la partida para retomarla al volver de la máquina.
    // La página de milkshakes lee el sabor que toca preparar con:
    // saboresMilkshake[milkshakesListos]
    sessionStorage.setItem(
      'partida',
      JSON.stringify(partidaActual({ milkshakesAntes: milkshakesListos }))
    );
    router.push(RUTA_MILKSHAKE);
  };

  // Tocar la freidora
  const tocarFreidora = () => {
    // Si hay un ingrediente en la mano, este click solo lo suelta
    if (!activoRef.current || manoRef.current) return;

    if (cantidadFritos === 0) {
      mostrarAviso('Este pedido no lleva nada de la freidora');
      return;
    }
    if (fritosListos >= cantidadFritos) {
      mostrarAviso('Ya freíste todo lo del pedido 🍟');
      return;
    }

    if (MODO_PRUEBA_FREIDORA) {
      const frito = fritoPorId(fritosPedidos[fritosListos]);
      setFritosListos((n) => n + 1);
      mostrarAviso(`${frito.emoji} ${frito.nombre} listas (modo prueba)`);
      return;
    }

    // Guardamos la partida para retomarla al volver de la freidora.
    // La página /freidora lee qué toca freír con:
    // fritosPedidos[fritosListos]
    sessionStorage.setItem('partida', JSON.stringify(partidaActual()));
    router.push(RUTA_FREIDORA);
  };

  // Pantalla completa
  const alternarPantallaCompleta = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.();
    }
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
    setRestauradas((r) => Math.min(r, Math.max(0, miHamburguesa.length - 1)));
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
      if (milkshakesListos < milkshakesPedidos) {
        alert('¡Falta preparar el milkshake! Tocá la máquina de milkshakes.');
        return;
      }
      if (fritosListos < cantidadFritos) {
        alert('¡Falta freír lo del pedido! Tocá la freidora.');
        return;
      }
      const puntos = 100 + milkshakesPedidos * 50 + cantidadFritos * 50;
      setPuntaje((anterior) => anterior + puntos);
      alert(`¡Pedido correcto! Ganaste ${puntos} puntos.`);
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
  const hamburguesaCompleta =
    !hayError &&
    recetaObjetivo.length > 0 &&
    correctos === recetaObjetivo.length;
  const faltanMilkshakes = milkshakesListos < milkshakesPedidos;
  const faltanFritos = fritosListos < cantidadFritos;
  const pedidoCompleto =
    hamburguesaCompleta && !faltanMilkshakes && !faltanFritos;

  // Milkshakes ya preparados: se preparan en el orden del pedido, así que son
  // los primeros "milkshakesListos" sabores de la lista
  const milkshakesServidos = saboresMilkshake
    .slice(0, milkshakesListos)
    .map(saborPorId);

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

    // PEGADO_EXTRA hace que cada capa se meta un poco más en la de abajo
    acumulado += alto * (1 - Math.min(0.9, p.solape + PEGADO_EXTRA));
    return capa;
  });

  /* ---------- BANDEJAS ---------- */
  const { asignadas } = asignarBandejas(todosLosIngredientes);

  /* ---------- PANTALLAS DE CARGA / ERROR ---------- */
  if (error) {
    return (
      <main className="min-h-screen flex flex-col gap-4 items-center justify-center bg-amber-50 p-6">
        <p className="text-center text-red-700">{error}</p>
        <button
          onClick={() => iniciarJuego()}
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
    <main className="partida-juego">
      <div
        className={`partida-escenario ${mano ? 'con-mano' : ''} ${
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

          {/* Los milkshakes van en su propia sección, siempre debajo de los ingredientes */}
          {milkshakesPedidos > 0 && (
            <section className="ticket-bebidas">
              <h3 className="ticket-subtitulo">BEBIDAS</h3>
              <ul className="ticket-lista ticket-extra">
                {saboresMilkshake.map((idSabor, i) => {
                  const sabor = saborPorId(idSabor);
                  const hecho = i < milkshakesListos;
                  return (
                    <li
                      key={`milkshake-${i}`}
                      className={`ticket-item ${hecho ? 'hecho' : ''} ${
                        i === milkshakesListos ? 'siguiente' : ''
                      }`}
                    >
                      <span className="ticket-icono emoji">{sabor.emoji}</span>
                      <span className="ticket-nombre">
                        Milkshake de {sabor.nombre}
                      </span>
                      <span className="ticket-marca">{hecho ? '✓' : ''}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Lo de la freidora va en su propia sección, debajo de las bebidas */}
          {cantidadFritos > 0 && (
            <section className="ticket-bebidas">
              <h3 className="ticket-subtitulo">FREIDORA</h3>
              <ul className="ticket-lista ticket-extra">
                {fritosPedidos.map((idFrito, i) => {
                  const frito = fritoPorId(idFrito);
                  const hecho = i < fritosListos;
                  return (
                    <li
                      key={`frito-${i}`}
                      className={`ticket-item ${hecho ? 'hecho' : ''} ${
                        i === fritosListos ? 'siguiente' : ''
                      }`}
                    >
                      <span className="ticket-icono emoji">{frito.emoji}</span>
                      <span className="ticket-nombre">{frito.nombre}</span>
                      <span className="ticket-marca">{hecho ? '✓' : ''}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {hayError && <p className="ticket-nota error">¡Ese no va! Usá DESHACER</p>}
          {!hayError && hamburguesaCompleta && faltanMilkshakes && (
            <p className="ticket-nota">Falta el milkshake 🥤</p>
          )}
          {!hayError && hamburguesaCompleta && faltanFritos && (
            <p className="ticket-nota">Falta la freidora 🍟</p>
          )}
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
          <button onClick={() => iniciarJuego()} className="hud-boton claro">
            Reiniciar
          </button>
          <button
            onClick={alternarPantallaCompleta}
            className="hud-boton"
            title="Pantalla completa"
          >
            ⛶
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
        <div className="partida-pila">
          {capas.map((capa, indice) => (
            <div
              key={`${capa.ingrediente.id}-${indice}`}
              className="partida-capa"
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
                className="partida-imagen-ingrediente"
                style={indice < restauradas ? { animation: 'none' } : undefined}
              />
            </div>
          ))}
        </div>

        {/* ---------- MILKSHAKES PREPARADOS (bandeja a la derecha del plato) ---------- */}
        <div
          className="partida-bandeja-milkshakes"
          style={{
            left: `${BANDEJA_MILKSHAKE.x}%`,
            bottom: `${BANDEJA_MILKSHAKE.base}%`,
          }}
        >
          {MOSTRAR_ZONAS && (
            <span
              className="partida-bandeja-milkshakes-guia"
              style={{
                width: `${
                  (MAX_MILKSHAKES - 1) * BANDEJA_MILKSHAKE.separacion +
                  BANDEJA_MILKSHAKE.ancho + 1
                }cqw`,
                height: `${
                  BANDEJA_MILKSHAKE.ancho * PROPORCION_MILKSHAKE +
                  (MAX_MILKSHAKES - 1) * BANDEJA_MILKSHAKE.separacionVertical
                }cqw`,
                bottom: `${
                  -((MAX_MILKSHAKES - 1) * BANDEJA_MILKSHAKE.separacionVertical) / 2
                }cqw`,
              }}
            >
              🥤 milkshakes
            </span>
          )}

          {milkshakesServidos.map((sabor, i) => (
            <img
              key={`milkshake-servido-${i}`}
              src={sabor.imagen}
              alt={`Milkshake de ${sabor.nombre}`}
              title={`Milkshake de ${sabor.nombre}`}
              draggable={false}
              className="partida-milkshake-servido"
              style={{
                // posiciones fijas según la cantidad pedida: no se corren al sumar otro
                left: `${
                  (i - (Math.max(milkshakesPedidos, 1) - 1) / 2) *
                  BANDEJA_MILKSHAKE.separacion
                }cqw`,
                // el primero queda atrás (arriba) y el último adelante (abajo)
                bottom: `${
                  ((Math.max(milkshakesPedidos, 1) - 1) / 2 - i) *
                  BANDEJA_MILKSHAKE.separacionVertical
                }cqw`,
                zIndex: i + 1, // el de adelante tapa al de atrás
                width: `${BANDEJA_MILKSHAKE.ancho}cqw`,
                ...(i < milkshakesRestaurados ? { animation: 'none' } : {}),
              }}
            />
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

        {/* Máquina de milkshakes (del fondo) - color ROSA */}
        <button
          type="button"
          data-nombre="Milkshakes"
          title="Milkshakes"
          onPointerDown={tocarMaquinaMilkshake}
          className={`bandeja maquina milkshake ${
            faltanMilkshakes ? 'pendiente' : ''
          } ${!activo ? 'deshabilitado' : ''}`}
          style={{
            left: `${MAQUINA_MILKSHAKE.left}%`,
            top: `${MAQUINA_MILKSHAKE.top}%`,
            width: `${MAQUINA_MILKSHAKE.width}%`,
            height: `${MAQUINA_MILKSHAKE.height}%`,
          }}
        />

        {/* Freidora (del fondo) - color AMARILLO */}
        <button
          type="button"
          data-nombre="Freidora"
          title="Freidora"
          onPointerDown={tocarFreidora}
          className={`bandeja maquina freidora ${
            faltanFritos ? 'pendiente' : ''
          } ${!activo ? 'deshabilitado' : ''}`}
          style={{
            left: `${FREIDORA.left}%`,
            top: `${FREIDORA.top}%`,
            width: `${FREIDORA.width}%`,
            height: `${FREIDORA.height}%`,
          }}
        />

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