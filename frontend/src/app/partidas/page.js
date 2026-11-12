'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import './partidas.css';
import Popup from 'reactjs-popup';

const API_URL = 'http://localhost:4000/api';

// false = al soltar una carne en la parrilla se va a la página /parrilla.
// true  = (solo para pruebas) la carne se agrega directo a la hamburguesa.
const MODO_PRUEBA_PARRILLA = false;
const RUTA_PARRILLA = '/parrilla';

// Milkshakes: al tocar la máquina del fondo se va a otra página.
// true = al tocar la máquina se da el milkshake por hecho (para probar).
const MODO_PRUEBA_MILKSHAKE = false;
const RUTA_MILKSHAKE = '/milkshakes';

// Freidora: al tocar la freidora del fondo se va a /freidora.
// true = al tocar la freidora se da lo frito por hecho (para probar).
const MODO_PRUEBA_FREIDORA = false;
const RUTA_FREIDORA = '/freidora';

// Cuando se acaba el tiempo de la partida se va al ranking
const RUTA_RANKING = '/ranking';

// ---------------------------------------------------------------------------
// TODO LO DE ABAJO AHORA VIENE DEL BACK (ver los endpoints nuevos del index.js)
//   GET /api/config-juego   -> tiempo por pedido, máximos, probabilidades y tamaños de papas
//   GET /api/milkshakes     -> sabores de milkshake (tabla Ingredientes, seccion 'milkshake')
//   GET /api/fritos         -> cosas de la freidora (tabla Ingredientes, seccion 'papas')
//   GET /api/extras-pedido  -> milkshakes / fritos / tamaños al azar para un pedido nuevo
//   GET /api/bandejas       -> posición de cada bandeja / máquina del fondo (tabla Bandejas)
// La columna "tipo" de esas filas es la IMAGEN (milkshake terminado / cartón de papas lleno).
// Los ids (vainilla, chocolate, cookies-cream, frutilla, papas, pequeno, mediano, grande)
// son los mismos de siempre, así que /milkshakes y /freidora siguen funcionando igual.
// ---------------------------------------------------------------------------

// Valores de reserva: solo se usan hasta que el back responde
const CONFIG_DEFECTO = {
  tiempoPartida: 60,
  maxMilkshakes: 2,
  maxFritos: 2,
  tamanosFritos: [],
};

const SABOR_VACIO = { id: '', nombre: 'Milkshake', emoji: '🥤', imagen: '' };
const FRITO_VACIO = { id: '', nombre: 'Papas', emoji: '🍟', imagen: '' };

// Cartón de papas ya entregado (el que aparece en la bandeja de la cocina)
const IMG_CARTON_PAPAS = '/papas.png';

// Si el tamaño guardado no existe, se elige uno al azar de los que mandó el back
const tamanoValidoEn = (t, ids) =>
  ids.includes(t)
    ? t
    : ids.length > 0
      ? ids[Math.floor(Math.random() * ids.length)]
      : t;

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

// NUEVO: bandeja donde aparecen las papas ya entregadas en la freidora.
// Se ajusta igual que la de los milkshakes (MOSTRAR_ZONAS = true muestra un recuadro amarillo):
//   x          = centro del grupo de paquetes, en % del ANCHO
//   base       = dónde apoya la base del cartón, en % del ALTO desde abajo
//   separacion = distancia horizontal entre paquetes (en cqw)
//   anchos     = ancho de cada paquete según su tamaño (en cqw).
//                Mantienen la proporción 125 : 156 : 188 de la freidora.
//   separacionVertical = cuánto se escalonan en profundidad: la primera queda un poco
//                        más atrás (arriba) y la última más adelante (abajo)
// (la imagen del cartón lleno ahora viene de la columna "tipo" de la tabla Ingredientes)
const BANDEJA_FRITAS = {
  x: 39.6,               // lado IZQUIERDO de la bandeja (el plato está en ~50%)
  base: 29,
  separacion: 3.2,       // las papas se superponen un poco para que entren a la izquierda del plato
  separacionVertical: 1.8,
  anchos: { pequeno: 6.2, mediano: 8.25, grande: 9.3 }, // proporción 125 : 156 : 188
};
const PROPORCION_PAPAS = 1.238 / 1.063; // alto / ancho de papas.png (cartón lleno)

// true = dibuja un recuadro verde sobre cada bandeja con su nombre,
// para ajustar las posiciones de la tabla Bandejas si no coinciden con el fondo.
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

// Un milkshake (o cualquier frito) nunca debe mezclarse con la hamburguesa.
// Por si /api/orden-aleatoria los mandara dentro de la receta: se detectan por
// la sección que viene del back y, por las dudas, por el nombre.
const esMilkshake = (ing) =>
  normalizar(ing?.seccion) === 'milkshake' ||
  /milkshake|batido/.test(normalizar(ing?.nombre));

const esFrito = (ing) =>
  normalizar(ing?.seccion) === 'papas' ||
  /(^|\s)papas?(\s|$)/.test(normalizar(ing?.nombre));

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
   Bandejas del fondo (cocina.png). Las posiciones (en % del escenario) vienen
   del back (GET /api/bandejas, tabla Bandejas). Cada bandeja de ingrediente
   trae el id_ingrediente de la tabla Ingredientes, así que se une por id.
   --------------------------------------------------------- */
const mismoId = (a, b) =>
  a !== undefined && a !== null && b !== undefined && b !== null && Number(a) === Number(b);

const asignarBandejas = (ingredientes, bandejas) => {
  const asignadas = [];
  const usados = new Set();

  bandejas
    .filter((b) => b.id_ingrediente !== null && b.id_ingrediente !== undefined)
    .forEach((bandeja) => {
      const ingrediente = ingredientes.find((i) =>
        mismoId(i.id_ingrediente, bandeja.id_ingrediente)
      );
      if (ingrediente) {
        asignadas.push({ bandeja, ingrediente });
        usados.add(ingrediente);
      }
    });

  return { asignadas, sinBandeja: ingredientes.filter((i) => !usados.has(i)) };
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
  const [tiempo, setTiempo] = useState(CONFIG_DEFECTO.tiempoPartida);
  const [puntaje, setPuntaje] = useState(0);
  const [pausado, setPausado] = useState(false);

  // Todo esto viene del back: sabores de milkshake, cosas de la freidora y la
  // configuración del juego (tiempo, máximos, tamaños de papas).
  const [saboresDisponibles, setSaboresDisponibles] = useState([]);
  const [fritosDisponibles, setFritosDisponibles] = useState([]);
  const [config, setConfig] = useState(CONFIG_DEFECTO);
  // Posición de las bandejas / máquinas del fondo (tabla Bandejas)
  const [bandejas, setBandejas] = useState([]);

  const saborPorId = (id) =>
    saboresDisponibles.find((s) => s.id === id) ?? saboresDisponibles[0] ?? SABOR_VACIO;
  const fritoPorId = (id) =>
    fritosDisponibles.find((f) => f.id === id) ?? fritosDisponibles[0] ?? FRITO_VACIO;

  const tamanoValido = (t) =>
    tamanoValidoEn(t, config.tamanosFritos.map((x) => x.id));
  const nombreTamano = (t) =>
    config.tamanosFritos.find((x) => x.id === t)?.nombre ?? t;

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

  // NUEVO: tamaño de cada frito pedido (mismo orden que fritosPedidos),
  // ej. ['mediano', 'grande']. /freidora lo lee como "tamanosFritos".
  const [tamanosFritos, setTamanosFritos] = useState([]);

  // NUEVO: cuántos paquetes ya estaban en la bandeja antes de ir a la freidora
  // (esos no repiten la animación)
  const [fritosRestaurados, setFritosRestaurados] = useState(0);

  // Imágenes recortadas: { '/lechuga.png': { url, w, h } }
  const [recortes, setRecortes] = useState({});
  const [imagenesListas, setImagenesListas] = useState(false);

  // --- Arrastre ---
  const [mano, setMano] = useState(null); // ingrediente que sigue al cursor
  const [anchoMano, setAnchoMano] = useState(140);
  const [zonaActiva, setZonaActiva] = useState(null); // 'plato' | 'parrilla' | null
  const [aviso, setAviso] = useState('');

  // Popup de mensajes (reemplaza a los alert)
  // { titulo, mensaje, tipo: 'ok' | 'error' | 'aviso', alCerrar }
  const [dialogo, setDialogo] = useState(null);

  const mostrarDialogo = (titulo, mensaje, tipo = 'aviso', alCerrar = null) =>
    setDialogo({ titulo, mensaje, tipo, alCerrar });

  const cerrarDialogo = () => {
    if (!dialogo) return;
    const { alCerrar } = dialogo;
    setDialogo(null);
    if (alCerrar) alCerrar();
  };

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

  // Mientras el popup está abierto el juego queda frenado
  const activo = !(pausado || tiempo <= 0 || cargando || error || dialogo);
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
    tamanosFritos, // NUEVO: /freidora lo usa para saber qué tamaño pide cada papa
    fritosListos,
    guardadoEn: Date.now(),
    ...extra,
  });

  // Obtener ingredientes y pedido aleatorio.
  // Si viene una partida guardada (al volver de la parrilla, de los
  // milkshakes o de la freidora) se retoma en vez de empezar un pedido nuevo.
  // conservarTiempo = true: se pide un pedido nuevo SIN reiniciar el tiempo de la
  // partida (así pasa al entregar un pedido). Reiniciar / primer inicio sí lo reinician.
  const iniciarJuego = async (guardada = null, conservarTiempo = false) => {
    // OJO: algunos botones llaman a esta función con el evento del click
    const partida =
      guardada && Array.isArray(guardada.recetaObjetivo) ? guardada : null;

    setCargando(true);
    setError('');
    setPausado(false);
    setDialogo(null);
    cancelarMano();

    if (!partida) {
      sessionStorage.removeItem('partida');
      setMiHamburguesa([]);
      setRestauradas(0);
      setMilkshakesListos(0);
      setMilkshakesRestaurados(0);
      setFritosListos(0);
      setFritosRestaurados(0); // NUEVO
    }

    try {
      const [
        resIngredientes,
        resOrden,
        resExtras,
        resMilkshakes,
        resFritos,
        resConfig,
        resBandejas,
      ] = await Promise.all([
        fetch(`${API_URL}/ingredientes`),
        partida ? Promise.resolve(null) : fetch(`${API_URL}/orden-aleatoria`),
        partida ? Promise.resolve(null) : fetch(`${API_URL}/extras-pedido`),
        fetch(`${API_URL}/milkshakes`),
        fetch(`${API_URL}/fritos`),
        fetch(`${API_URL}/config-juego`),
        fetch(`${API_URL}/bandejas`),
      ]);

      if (
        !resIngredientes.ok ||
        !resMilkshakes.ok ||
        !resFritos.ok ||
        !resConfig.ok ||
        !resBandejas.ok ||
        (resOrden && !resOrden.ok) ||
        (resExtras && !resExtras.ok)
      ) {
        throw new Error('No se pudieron obtener los datos.');
      }

      const ingredientesData = await resIngredientes.json();
      const ordenData = partida ? partida.recetaObjetivo : await resOrden.json();
      const extrasData = resExtras ? await resExtras.json() : null;
      const saboresData = await resMilkshakes.json();
      const fritosData = await resFritos.json();
      const configData = await resConfig.json();
      const bandejasData = await resBandejas.json();

      if (
        !Array.isArray(ordenData) ||
        !Array.isArray(ingredientesData) ||
        !Array.isArray(saboresData) ||
        !Array.isArray(fritosData) ||
        !Array.isArray(bandejasData) ||
        !Array.isArray(configData?.tamanosFritos)
      ) {
        throw new Error('La respuesta del servidor no es válida.');
      }

      // Datos que antes eran variables del front y ahora vienen del back
      setSaboresDisponibles(saboresData);
      setFritosDisponibles(fritosData);
      setConfig(configData);
      setBandejas(bandejasData);

      // Los milkshakes y las papas nunca forman parte de los ingredientes
      // de la hamburguesa
      const ingredientesLimpios = ingredientesData.filter(
        (i) => !esMilkshake(i) && !esFrito(i)
      );

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
        setTodosLosIngredientes(ingredientesLimpios);
        setMiHamburguesa(hamburguesa);
        setRestauradas(
          Array.isArray(partida.miHamburguesa) ? partida.miHamburguesa.length : 0
        );
        setTiempo(
          Math.max(0, (partida.tiempo ?? configData.tiempoPartida) - transcurrido)
        );
        setPuntaje(partida.puntaje ?? 0);
        setSaboresMilkshake(
          Array.isArray(partida.saboresMilkshake) ? partida.saboresMilkshake : []
        );
        setMilkshakesListos(partida.milkshakesListos ?? 0);
        // "milkshakesAntes" lo guarda la cocina al salir hacia la máquina
        setMilkshakesRestaurados(
          partida.milkshakesAntes ?? partida.milkshakesListos ?? 0
        );

        const fritos = Array.isArray(partida.fritosPedidos)
          ? partida.fritosPedidos
          : [];
        setFritosPedidos(fritos);
        // NUEVO: los tamaños viajan con la partida (uno por cada frito pedido)
        const idsTamano = configData.tamanosFritos.map((x) => x.id);
        setTamanosFritos(
          fritos.map((_, i) =>
            tamanoValidoEn(
              Array.isArray(partida.tamanosFritos) ? partida.tamanosFritos[i] : null,
              idsTamano
            )
          )
        );
        setFritosListos(partida.fritosListos ?? 0);
        // NUEVO: "fritosAntes" lo guarda la cocina al salir hacia la freidora
        setFritosRestaurados(partida.fritosAntes ?? partida.fritosListos ?? 0);
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
        // Los milkshakes y las papas nunca forman parte de la receta de la hamburguesa
        const recetaLimpia = ordenData.filter((o) => !esMilkshake(o) && !esFrito(o));

        // El tiempo de la partida NO se reinicia al entregar un pedido
        if (!conservarTiempo) setTiempo(configData.tiempoPartida);
        setRecetaObjetivo(asegurarCarne(recetaLimpia, ingredientesLimpios));
        setTodosLosIngredientes(ingredientesLimpios);

        // Milkshakes (con su sabor), fritos y tamaños: los elige el back al azar
        setSaboresMilkshake(
          Array.isArray(extrasData?.saboresMilkshake) ? extrasData.saboresMilkshake : []
        );
        setFritosPedidos(
          Array.isArray(extrasData?.fritosPedidos) ? extrasData.fritosPedidos : []
        );
        setTamanosFritos(
          Array.isArray(extrasData?.tamanosFritos) ? extrasData.tamanosFritos : []
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
    const { sinBandeja } = asignarBandejas(todosLosIngredientes, bandejas);
    if (sinBandeja.length > 0) {
      console.warn(
        'Ingredientes sin bandeja en el fondo:',
        sinBandeja.map((i) => i.nombre)
      );
    }
  }, [todosLosIngredientes, bandejas]);

  // Cronómetro (se frena mientras hay un popup abierto)
  useEffect(() => {
    if (cargando || pausado || tiempo <= 0 || error || dialogo) {
      return;
    }

    const intervalo = setInterval(() => {
      setTiempo((anterior) => Math.max(0, anterior - 1));
    }, 1000);

    return () => clearInterval(intervalo);
  }, [cargando, pausado, tiempo, error, dialogo]);

  // Si se pausa o se acaba el tiempo con un ingrediente en la mano, se suelta
  useEffect(() => {
    if (!activo && manoRef.current) cancelarMano();
  }, [activo]);

  // Se acabó el tiempo: se manda al jugador al ranking.
  // (También pasa si volvés de la parrilla / milkshakes / freidora y el tiempo
  // ya se había terminado mientras estabas allá.)
  useEffect(() => {
    if (cargando || error) return;
    if (tiempo <= 0) router.push(RUTA_RANKING);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiempo, cargando, error]);

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
    // La página /freidora lee qué toca freír con fritosPedidos / tamanosFritos
    // (a partir de fritosListos). NUEVO: "fritosAntes" evita repetir la
    // animación de los paquetes que ya estaban en la bandeja.
    sessionStorage.setItem(
      'partida',
      JSON.stringify(partidaActual({ fritosAntes: fritosListos }))
    );
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
    if (tiempo <= 0 || pausado || cargando || error || dialogo) {
      return;
    }

    if (miHamburguesa.length !== recetaObjetivo.length) {
      mostrarDialogo(
        'Pedido incompleto',
        '¡La cantidad de ingredientes no coincide!',
        'error'
      );
      return;
    }

    const esCorrecta = miHamburguesa.every(
      (ingrediente, indice) => clave(ingrediente) === clave(recetaObjetivo[indice])
    );

    if (esCorrecta) {
      if (milkshakesListos < milkshakesPedidos) {
        mostrarDialogo(
          'Falta algo',
          '¡Falta preparar el milkshake! Tocá la máquina de milkshakes.',
          'aviso'
        );
        return;
      }
      if (fritosListos < cantidadFritos) {
        mostrarDialogo(
          'Falta algo',
          '¡Falta freír lo del pedido! Tocá la freidora.',
          'aviso'
        );
        return;
      }
      const puntos = 100 + milkshakesPedidos * 50 + cantidadFritos * 50;
      setPuntaje((anterior) => anterior + puntos);
      // Al cerrar el popup arranca el pedido nuevo (el tiempo de la partida sigue corriendo)
      mostrarDialogo(
        '¡Pedido correcto!',
        `Ganaste ${puntos} puntos.`,
        'ok',
        () => iniciarJuego(null, true)
      );
    } else {
      mostrarDialogo(
        'No coincide',
        'El pedido no coincide. ¡Probá de nuevo!',
        'error'
      );
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

  // NUEVO: papas ya entregadas en la freidora. Se entregan en el orden del pedido,
  // así que son los primeros "fritosListos" del pedido, cada una con su tamaño.
  const fritosServidos = fritosPedidos.slice(0, fritosListos).map((idDelFrito, i) => ({
    frito: fritoPorId(idDelFrito),
    tamano: tamanoValido(tamanosFritos[i]),
  }));

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
  const { asignadas } = asignarBandejas(todosLosIngredientes, bandejas);
  const zonaMaquinaMilkshake = bandejas.find((b) => b.codigo === 'maquina-milkshake');
  const zonaFreidora = bandejas.find((b) => b.codigo === 'freidora');

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
                {saboresMilkshake.map((idSaborPedido, i) => {
                  const sabor = saborPorId(idSaborPedido);
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
                {fritosPedidos.map((idDelFrito, i) => {
                  const frito = fritoPorId(idDelFrito);
                  const hecho = i < fritosListos;
                  return (
                    <li
                      key={`frito-${i}`}
                      className={`ticket-item ${hecho ? 'hecho' : ''} ${
                        i === fritosListos ? 'siguiente' : ''
                      }`}
                    >
                      <span className="ticket-icono emoji">{frito.emoji}</span>
                      {/* NUEVO: se muestra el tamaño pedido */}
                      <span className="ticket-nombre">
                        {frito.nombre} ({nombreTamano(tamanoValido(tamanosFritos[i]))})
                      </span>
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
                  (config.maxMilkshakes - 1) * BANDEJA_MILKSHAKE.separacion +
                  BANDEJA_MILKSHAKE.ancho + 1
                }cqw`,
                height: `${
                  BANDEJA_MILKSHAKE.ancho * PROPORCION_MILKSHAKE +
                  (config.maxMilkshakes - 1) * BANDEJA_MILKSHAKE.separacionVertical
                }cqw`,
                bottom: `${
                  -((config.maxMilkshakes - 1) * BANDEJA_MILKSHAKE.separacionVertical) / 2
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

        {/* ---------- NUEVO: PAPAS ENTREGADAS (bandeja a la derecha de los milkshakes) ---------- */}
        <div
          className="partida-bandeja-fritas"
          style={{
            left: `${BANDEJA_FRITAS.x}%`,
            bottom: `${BANDEJA_FRITAS.base}%`,
          }}
        >
          {MOSTRAR_ZONAS && (
            <span
              className="partida-bandeja-fritas-guia"
              style={{
                width: `${
                  (config.maxFritos - 1) * BANDEJA_FRITAS.separacion +
                  BANDEJA_FRITAS.anchos.grande + 1
                }cqw`,
                height: `${
                  BANDEJA_FRITAS.anchos.grande * PROPORCION_PAPAS +
                  (config.maxFritos - 1) * BANDEJA_FRITAS.separacionVertical
                }cqw`,
                bottom: `${
                  -((config.maxFritos - 1) * BANDEJA_FRITAS.separacionVertical) / 2
                }cqw`,
              }}
            >
              🍟 papas
            </span>
          )}

          {fritosServidos.map(({ frito, tamano }, i) => (
            <img
              key={`frito-servido-${i}`}
              src={IMG_CARTON_PAPAS}
              alt={`${frito.nombre} (${nombreTamano(tamano)})`}
              title={`${frito.nombre} (${nombreTamano(tamano)})`}
              draggable={false}
              className="partida-frito-servido"
              style={{
                // posiciones fijas según la cantidad pedida: no se corren al sumar otro
                left: `${
                  (i - (Math.max(cantidadFritos, 1) - 1) / 2) *
                  BANDEJA_FRITAS.separacion
                }cqw`,
                // la primera queda atrás (arriba) y la última adelante (abajo)
                bottom: `${
                  ((Math.max(cantidadFritos, 1) - 1) / 2 - i) *
                  BANDEJA_FRITAS.separacionVertical
                }cqw`,
                // el ancho depende del tamaño pedido (pequeño / mediano / grande)
                width: `${BANDEJA_FRITAS.anchos[tamano] ?? BANDEJA_FRITAS.anchos.mediano}cqw`,
                zIndex: i + 1,
                ...(i < fritosRestaurados ? { animation: 'none' } : {}),
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
        {zonaMaquinaMilkshake && (
          <button
            type="button"
            data-nombre="Milkshakes"
            title="Milkshakes"
            onPointerDown={tocarMaquinaMilkshake}
            className={`bandeja maquina milkshake ${
              faltanMilkshakes ? 'pendiente' : ''
            } ${!activo ? 'deshabilitado' : ''}`}
            style={{
              left: `${zonaMaquinaMilkshake.left}%`,
              top: `${zonaMaquinaMilkshake.top}%`,
              width: `${zonaMaquinaMilkshake.width}%`,
              height: `${zonaMaquinaMilkshake.height}%`,
            }}
          />
        )}

        {/* Freidora (del fondo) - color AMARILLO */}
        {zonaFreidora && (
          <button
            type="button"
            data-nombre="Freidora"
            title="Freidora"
            onPointerDown={tocarFreidora}
            className={`bandeja maquina freidora ${
              faltanFritos ? 'pendiente' : ''
            } ${!activo ? 'deshabilitado' : ''}`}
            style={{
              left: `${zonaFreidora.left}%`,
              top: `${zonaFreidora.top}%`,
              width: `${zonaFreidora.width}%`,
              height: `${zonaFreidora.height}%`,
            }}
          />
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

      {/* ---------- POPUP DE MENSAJES (reemplaza a los alert) ---------- */}
      <Popup
        open={!!dialogo}
        modal
        closeOnDocumentClick
        onClose={cerrarDialogo}
        className="dialogo"
      >
        {dialogo && (
          <div className={`dialogo-caja ${dialogo.tipo}`}>
            <h3 className="dialogo-titulo">{dialogo.titulo}</h3>
            <p className="dialogo-mensaje">{dialogo.mensaje}</p>
            <button
              type="button"
              className="dialogo-boton"
              onClick={cerrarDialogo}
            >
              Aceptar
            </button>
          </div>
        )}
      </Popup>
    </main>
  );
}