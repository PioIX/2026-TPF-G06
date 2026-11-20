const express = require("express");
const cors = require("cors");
const session = require("express-session");
const { Server } = require("socket.io");
const { realizarQuery } = require("./modulos/mysql");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const sessionMiddleware = session({
  secret: "supersarasa",
  resave: false,
  saveUninitialized: false,
});
app.use(sessionMiddleware);

const server = app.listen(PORT, () => {
  console.log(`Servidor NodeJS corriendo en http://localhost:${PORT}/`);
});

const io = new Server(server, {
  cors: {
    origin: ["*"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: false,
  },
});

io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

// =========================================================
// MANEJO DE EVENTOS DE SOCKET.IO
// =========================================================
io.on("connection", (socket) => {
  console.log("🟢 Nuevo cliente conectado por Socket.IO con ID:", socket.id);

  socket.on("register", async (data, callback) => {
    console.log("📥 Datos recibidos en el servidor:", data);


    try {
      // 1. Verificar si el usuario o mail ya existe
      let existe = await realizarQuery(`
        SELECT * FROM Usuarios WHERE nombre = '${data.nombre}' OR mail = '${data.mail}'
      `);

      if (existe.length > 0) {
        console.log("⚠️ El usuario o mail ya existe");
        return callback({
          ok: false,
          msg: "El nombre de usuario o el email ya están en uso."
        });
      }

  
      await realizarQuery(`
        INSERT INTO Usuarios (nombre, contra, mail) VALUES
        ('${data.nombre}', '${data.contra}', '${data.mail}');
      `);

      console.log("✅ Usuario insertado con éxito en MySQL");
      callback({
        ok: true,
        msg: "Usuario registrado con éxito",
        usuario: { nombre: data.nombre, mail: data.mail }
      });

    } catch (error) {
      console.error("❌ Error en MySQL:", error);
      callback({
        ok: false,
        msg: "Error interno al intentar registrar."
      });
    }
  });

  // Evento para que el usuario se una a la sala de un chat específico
  socket.on("join_chat", (id_chat) => {
    socket.join(`chat_${id_chat}`);
    console.log(`Socket ${socket.id} se unió a la sala: chat_${id_chat}`);
  });

  // Evento para enviar un mensaje en tiempo real y guardarlo en la DB
  socket.on("send_message", async (data, callback) => {
    const { id_chat, id_emisor, contenido } = data;

    try {
      // 1. Guardar el mensaje en la base de datos
      const resultado = await realizarQuery(
        "INSERT INTO Mensajes (id_chat, id_emisor, contenido) VALUES (?, ?, ?)",
        [id_chat, id_emisor, contenido]
      );

      // 2. Consultar datos del emisor para adjuntarlos al evento emitido
      const emisor = await realizarQuery(
        "SELECT nombre FROM Usuarios WHERE id_usuario = ?",
        [id_emisor]
      );

      const nuevoMensaje = {
        id_mensaje: resultado.insertId,
        id_chat,
        id_emisor,
        contenido,
        fecha_hora: new Date(),
        nombre: emisor[0]?.nombre,
      };

      // 3. Emitir a TODOS los conectados en la sala del chat
      io.to(`chat_${id_chat}`).emit("receive_message", nuevoMensaje);

      if (callback) callback({ ok: true, mensaje: nuevoMensaje });
    } catch (error) {
      console.error("❌ Error al guardar/enviar mensaje:", error);
      if (callback) callback({ ok: false, msg: "Error al procesar el mensaje." });
    }
  });

  socket.on("disconnect", () => {
    console.log("🔴 Cliente desconectado:", socket.id);
  });
});

// =========================================================
// RUTAS EXPRESS INTACTAS
// =========================================================

app.post('/login', async function (req, res) {
    console.log(req.body);
    try {
      let respuesta = {
            ok: false,
            msg: "¿No tienes cuenta? Regístrate aquí"
        };
        let existe = await realizarQuery(`
            SELECT * FROM Usuarios WHERE mail = '${req.body.mail}' AND contra = '${req.body.contra}'
        `);

        if (existe.length > 0) {
            respuesta.msg = "El usuario existe.";
            respuesta.ok = true
        }
        return res.send({respuesta, existe});
    } catch (error) {
        console.log(error.message)
        res.send({ message: "usuario no existe registrate", ok: false });
    }
});


// 1. Endpoint para obtener TODOS los ingredientes
app.get('/api/ingredientes', async (req, res) => {
  try {
    const ingredientes = await realizarQuery('SELECT * FROM Ingredientes');
    res.json(ingredientes);
  } catch (error) {
    console.error("❌ Error al consultar ingredientes:", error);
    res.status(500).json({ error: "Error al obtener ingredientes de MySQL" });
  }
});

// 2. Endpoint para generar una orden/receta ALEATORIA
app.get('/api/orden-aleatoria', async (req, res) => {
  try {
    const ingredientes = await realizarQuery('SELECT * FROM Ingredientes');

    const panInf = ingredientes.find(i => i.seccion === 'abajo');
    const panSup = ingredientes.find(i => i.seccion === 'arriba');

    const rellenosPosibles = ingredientes.filter(
      i => i.seccion !== 'abajo' && i.seccion !== 'arriba'
    );

    if (!panInf || !panSup) {
      return res.status(400).json({ error: 'Faltan los panes en la tabla Ingredientes' });
    }

    const cantidadRelleno = Math.floor(Math.random() * 3) + 2;
    const relleno = [];

    for (let i = 0; i < cantidadRelleno; i++) {
      const ingredienteAzar = rellenosPosibles[Math.floor(Math.random() * rellenosPosibles.length)];
      relleno.push(ingredienteAzar);
    }

    const recetaValida = [panInf, ...relleno, panSup];
    res.json(recetaValida);
  } catch (error) {
    console.error("❌ Error al generar receta:", error);
    res.status(500).json({ error: "Error interno al generar receta" });
  }
});

// 3. Pedido completo: hamburguesa + papas (opcional) + bebida (opcional)
const TAMANOS = ['chica', 'mediana', 'grande'];
const BEBIDAS = ['cola']; // agregá más cuando tengas más imágenes
const elegir = (lista) => lista[Math.floor(Math.random() * lista.length)];

app.get('/api/pedido-aleatorio', async (req, res) => {
  try {
    const ingredientes = await realizarQuery('SELECT * FROM Ingredientes');

    const panInf = ingredientes.find(i => i.seccion === 'abajo');
    const panSup = ingredientes.find(i => i.seccion === 'arriba');
    const rellenosPosibles = ingredientes.filter(
      i => i.seccion !== 'abajo' && i.seccion !== 'arriba'
    );

    if (!panInf || !panSup) {
      return res.status(400).json({ error: 'Faltan los panes en la tabla Ingredientes' });
    }

    const cantidadRelleno = Math.floor(Math.random() * 3) + 2;
    const relleno = [];
    for (let i = 0; i < cantidadRelleno; i++) {
      relleno.push(elegir(rellenosPosibles));
    }

    res.json({
      hamburguesa: [panInf, ...relleno, panSup],
      papas: Math.random() < 0.6 ? elegir(TAMANOS) : null,
      bebida: Math.random() < 0.6
        ? { tipo: elegir(BEBIDAS), tamano: elegir(TAMANOS) }
        : null,
    });
  } catch (error) {
    console.error('❌ Error al generar pedido:', error);
    res.status(500).json({ error: 'Error interno al generar pedido' });
  }
});

// =========================================================
// NUEVO: DATOS DE LA PÁGINA DE PARTIDAS (milkshakes, freidora, config y extras del pedido)
// Todo esto antes eran variables / arrays dentro del front.
// Los sabores y los fritos salen de la tabla Ingredientes:
//   seccion = 'milkshake' -> sabores de milkshake (tipo = imagen del milkshake terminado)
//   seccion = 'papas'     -> cosas de la freidora (tipo = imagen del cartón lleno)
// =========================================================

// Configuración del juego (antes eran constantes del front)
const CONFIG_JUEGO = {
  tiempoPartida: 135,     // segundos de toda la partida: 2 minutos y 15 segundos
  maxHamburguesas: 2,     // la partida termina al entregar esta cantidad de hamburguesas
  // Todo pedido lleva SIEMPRE al menos 1 milkshake y 1 frito (freidora).
  // Estos máximos son la cantidad tope: cada pedido pide entre 1 y el máximo.
  maxMilkshakes: 2,            // cantidad máxima de milkshakes por pedido
  maxFritos: 2,                // cantidad máxima de fritos por pedido
  tiempoFrituraMs: 5000,       // cuánto tardan en freírse las papas (página /freidora)
  // Página /parrilla (segundos)
  parrilla: {
    coccion: { paty: 6, pollo: 6, veggie: 4 }, // lo que tarda en cocinarse CADA lado
    gracia: 3.5,           // margen, una vez cocido el lado, antes de que se queme
    duracionVolteo: 0.8,   // duración de la animación de dar vuelta
    esperaCocinada: 1.8,   // tiempo mostrando "¡en su punto!" antes de volver
    esperaQuemada: 2.6,    // tiempo mostrando "¡se quemó!" antes de volver
  },
  // Los ids son los que usa la página /freidora
  tamanosFritos: [
    { id: 'pequeno', nombre: 'Pequeño' },
    { id: 'mediano', nombre: 'Mediano' },
    { id: 'grande', nombre: 'Grande' },
  ],
};

const normalizarJuego = (texto = '') =>
  String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]/g, ' ')
    .trim();

const capitalizarJuego = (texto = '') =>
  texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto;

const slugJuego = (texto = '') => normalizarJuego(texto).replace(/\s+/g, '-');

// Las imágenes están en /public del front: se les agrega la barra inicial si falta
const rutaImagenJuego = (tipo) => {
  if (!tipo) return '';
  const t = String(tipo);
  return /^(\/|https?:|data:)/.test(t) ? t : `/${t}`;
};

// Solo decoración para el ticket (la tabla no tiene columna de emoji)
const EMOJI_SABORES = {
  vainilla: '🍦',
  chocolate: '🍫',
  'cookies-cream': '🍪',
  frutilla: '🍓',
};
const NOMBRES_SABORES = { 'cookies-cream': 'Cookies & Cream' };

const esMilkshakeJuego = (ing) =>
  normalizarJuego(ing?.seccion) === 'milkshake' ||
  /milkshake|batido/.test(normalizarJuego(ing?.nombre));

const esFritoJuego = (ing) =>
  normalizarJuego(ing?.seccion) === 'papas' ||
  /(^|\s)papas?(\s|$)/.test(normalizarJuego(ing?.nombre));

// Ids estables: son los mismos que reciben las páginas /milkshakes y /freidora
const idSaborJuego = (ing) => {
  const n = normalizarJuego(ing?.nombre).replace(/milkshake|batido/g, '').trim();
  if (n.includes('vainilla')) return 'vainilla';
  if (n.includes('choco')) return 'chocolate';
  if (n.includes('cookie') || n.includes('galleta') || n.includes('oreo')) return 'cookies-cream';
  if (n.includes('frutilla') || n.includes('fresa')) return 'frutilla';
  return slugJuego(n) || String(ing?.id_ingrediente ?? '');
};

const idFritoJuego = (ing) =>
  /papa/.test(normalizarJuego(ing?.nombre))
    ? 'papas'
    : slugJuego(ing?.nombre) || String(ing?.id_ingrediente ?? '');

const armarSabores = (ingredientes) =>
  ingredientes.filter(esMilkshakeJuego).map((ing) => {
    const id = idSaborJuego(ing);
    const base = normalizarJuego(ing.nombre).replace(/milkshake|batido/g, '').trim();
    return {
      id,
      nombre: NOMBRES_SABORES[id] ?? capitalizarJuego(base || normalizarJuego(ing.nombre)),
      emoji: EMOJI_SABORES[id] ?? '🥤',
      imagen: rutaImagenJuego(ing.tipo),
    };
  });

const armarFritos = (ingredientes) =>
  ingredientes.filter(esFritoJuego).map((ing) => ({
    id: idFritoJuego(ing),
    nombre: capitalizarJuego(normalizarJuego(ing.nombre)),
    emoji: '🍟',
    imagen: rutaImagenJuego(ing.tipo),
  }));

// 4. Configuración del juego
app.get('/api/config-juego', (req, res) => {
  res.json(CONFIG_JUEGO);
});

// 5. Sabores de milkshake disponibles (desde la tabla Ingredientes)
app.get('/api/milkshakes', async (req, res) => {
  try {
    const ingredientes = await realizarQuery('SELECT * FROM Ingredientes');
    res.json(armarSabores(ingredientes));
  } catch (error) {
    console.error('❌ Error al obtener milkshakes:', error);
    res.status(500).json({ error: 'Error al obtener los milkshakes de MySQL' });
  }
});

// 6. Cosas de la freidora disponibles (desde la tabla Ingredientes)
app.get('/api/fritos', async (req, res) => {
  try {
    const ingredientes = await realizarQuery('SELECT * FROM Ingredientes');
    res.json(armarFritos(ingredientes));
  } catch (error) {
    console.error('❌ Error al obtener fritos:', error);
    res.status(500).json({ error: 'Error al obtener los fritos de MySQL' });
  }
});

// 7. Milkshakes y fritos ALEATORIOS para un pedido nuevo
//    (sabores pedidos, fritos pedidos y el tamaño de cada frito, en el mismo orden)
//    Todo pedido lleva SIEMPRE al menos 1 milkshake y 1 frito (entre 1 y el máximo
//    de CONFIG_JUEGO). Solo quedan en 0 si la tabla Ingredientes no tiene ninguno cargado.
app.get('/api/extras-pedido', async (req, res) => {
  try {
    const ingredientes = await realizarQuery('SELECT * FROM Ingredientes');
    const sabores = armarSabores(ingredientes);
    const fritos = armarFritos(ingredientes);

    const cantidadMilkshakes =
      sabores.length > 0
        ? 1 + Math.floor(Math.random() * CONFIG_JUEGO.maxMilkshakes)
        : 0;

    const cantidadFritos =
      fritos.length > 0
        ? 1 + Math.floor(Math.random() * CONFIG_JUEGO.maxFritos)
        : 0;

    res.json({
      saboresMilkshake: Array.from({ length: cantidadMilkshakes }, () => elegir(sabores).id),
      fritosPedidos: Array.from({ length: cantidadFritos }, () => elegir(fritos).id),
      tamanosFritos: Array.from(
        { length: cantidadFritos },
        () => elegir(CONFIG_JUEGO.tamanosFritos).id
      ),
    });
  } catch (error) {
    console.error('❌ Error al generar extras del pedido:', error);
    res.status(500).json({ error: 'Error interno al generar los extras del pedido' });
  }
});


// 8. Posiciones de las bandejas del fondo (tabla Bandejas, en % del escenario).
//    Las de ingredientes traen id_ingrediente; las máquinas traen "codigo"
//    ('maquina-milkshake', 'freidora'). Ver bandejas.sql
app.get('/api/bandejas', async (req, res) => {
  try {
    const filas = await realizarQuery(
      'SELECT id_bandeja, id_ingrediente, codigo, pos_left, pos_top, pos_width, pos_height FROM Bandejas'
    );
    // MySQL devuelve los DECIMAL como texto: se pasan a número
    res.json(
      filas.map((f) => ({
        id_bandeja: f.id_bandeja,
        id_ingrediente: f.id_ingrediente,
        codigo: f.codigo,
        left: Number(f.pos_left),
        top: Number(f.pos_top),
        width: Number(f.pos_width),
        height: Number(f.pos_height),
      }))
    );
  } catch (error) {
    console.error('❌ Error al obtener bandejas:', error);
    res.status(500).json({ error: 'Error al obtener las bandejas de MySQL' });
  }
});

// 9. Sabores de la máquina de milkshakes: nombre e imagen desde Ingredientes
//    + color y posiciones desde la tabla SaboresMilkshake (ver milkshakes.sql)
app.get('/api/maquina-milkshake', async (req, res) => {
  try {
    const filas = await realizarQuery(
      `SELECT i.id_ingrediente, i.nombre, i.seccion, i.tipo,
              s.color, s.puntos, s.vaso_x, s.boton_left, s.boton_ancho
       FROM SaboresMilkshake s
       JOIN Ingredientes i ON i.id_ingrediente = s.id_ingrediente
       ORDER BY s.vaso_x ASC`
    );

    const sabores = filas
      .map((f) => {
        const [base] = armarSabores([f]); // id, nombre, emoji e imagen
        if (!base) return null;
        return {
          ...base,
          color: f.color,
          puntos: f.puntos,
          x: Number(f.vaso_x),
          boton: [Number(f.boton_left), Number(f.boton_ancho)],
        };
      })
      .filter(Boolean);

    res.json(sabores);
  } catch (error) {
    console.error('❌ Error al obtener la máquina de milkshakes:', error);
    res.status(500).json({ error: 'Error al obtener los sabores de la máquina de MySQL' });
  }
});




app.get("/sala/partidas", async function (req, res) {
  try {
    const partidas = await realizarQuery(`
      SELECT 
        p.id_partida,
        p.nombre_partida,
        p.id_usuario,
        p.hora_final,
        u.nombre AS creador_nombre
      FROM Partidas p
      LEFT JOIN Usuarios u ON p.id_usuario = u.id_usuario
    `);
    
    // Una partida está "ocupada" si hay algún jugador adentro (esperando o jugando)
    const partidasConEstado = partidas.map((p) => {
      const enMemoria = jugadoresEnPartida.find((j) => j.id_partida === p.id_partida);
      return { ...p, ocupada: !!enMemoria && enMemoria.jugadores.length > 0 };
    });

    return res.json({ ok: true, partidas: partidasConEstado });
  } catch (error) {
    console.error("Error al obtener partidas:", error.message);
    return res.status(500).json({ ok: false, message: error.message });
  }
});

// 2. Crear una nueva partida
app.post("/sala/crear-partida", async function (req, res) {
  try {
    const { id_usuario_creador, nombre_partida } = req.body;

    if (!id_usuario_creador) {
      return res.status(400).json({ 
        ok: false, 
        message: "Usuario no identificado. Inicia sesión nuevamente." 
      });
    }

    if (!nombre_partida) {
      return res.status(400).json({ 
        ok: false, 
        message: "Debe ingresar un nombre para la partida." 
      });
    }

    const hora_final = new Date(Date.now() + 3600000)
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");

    const query = `
      INSERT INTO Partidas (id_usuario, nombre_partida, hora_final) 
      VALUES (${id_usuario_creador}, '${nombre_partida}', '${hora_final}')
    `;

    const resultado = await realizarQuery(query);

    return res.json({
      ok: true,
      message: "Partida creada con éxito",
      id_partida: resultado.insertId
    });
  } catch (error) {
    console.error("Error exacto en MySQL:", error.message);
    return res.status(500).json({ 
      ok: false, 
      message: "Error en la base de datos: " + error.message 
    });
  }
});

// =========================================================
// RANKING  (tabla PuntajesPartida: una fila por jugador y por sala)
//  - El ranking es global: junta los puntajes de TODAS las salas del mes actual y
//    muestra a cada jugador una sola vez, con la SUMA de sus puntajes y hamburguesas.
//  - El empleado del mes es el primero de ese ranking: cambia solo cuando alguien lo supera.
//  - Cada partida que juega un jugador en una sala se SUMA a su fila de esa sala
//    (puntaje y hamburguesas acumulados); los jugadores de las otras salas no se tocan.
// =========================================================

// Segundos máximos entre que termina un jugador y el otro para que cuenten como la misma partida
const VENTANA_RONDA_SEG = 240;

// Solo cuenta el mes actual. Para un ranking de todos los tiempos, dejá este string vacío ('').
const FILTRO_MES = `WHERE p.fecha >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
    AND p.fecha < DATE_FORMAT(CURDATE() + INTERVAL 1 MONTH, '%Y-%m-01')`;

// La columna "fecha" guarda cuándo se anotó el puntaje (sirve para saber de qué mes es).
// Al iniciar el servidor se revisa si existe y, solo si falta, se crea.
(async () => {
  try {
    const existe = await realizarQuery(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PuntajesPartida' AND COLUMN_NAME = 'fecha'`
    );

    if (existe.length === 0) {
      await realizarQuery(
        "ALTER TABLE PuntajesPartida ADD COLUMN fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"
      );
      console.log("✅ Se agregó la columna fecha a PuntajesPartida");
    }
  } catch (error) {
    console.error("⚠️ No se pudo revisar/agregar la columna fecha en PuntajesPartida:", error.message);
  }
})();

// Ranking global: puntaje y hamburguesas TOTALES de cada jugador (suma de todas sus salas
// del mes), de mayor a menor. Ante empate gana quien hizo más hamburguesas.
async function obtenerRankingMensual() {
  const filas = await realizarQuery(
    `SELECT u.id_usuario, u.nombre,
            SUM(p.puntaje) AS puntaje,
            SUM(p.hamburguesas) AS hamburguesas
     FROM PuntajesPartida p
     JOIN Usuarios u ON u.id_usuario = p.id_usuario
     ${FILTRO_MES}
     GROUP BY u.id_usuario, u.nombre
     ORDER BY SUM(p.puntaje) DESC, SUM(p.hamburguesas) DESC, u.id_usuario ASC`
  );

  // MySQL devuelve las SUM como texto: se pasan a número
  return filas.map((f, i) => ({
    id_usuario: f.id_usuario,
    nombre: f.nombre,
    puntaje: Number(f.puntaje),
    hamburguesas: Number(f.hamburguesas),
    posicion: i + 1,
  }));
}

// Puntajes guardados de una sala
async function obtenerRankingSala(id_partida) {
  return await realizarQuery(
    `SELECT u.id_usuario, u.nombre, p.puntaje, p.hamburguesas
     FROM PuntajesPartida p
     JOIN Usuarios u ON u.id_usuario = p.id_usuario
     WHERE p.id_partida = ?
     ORDER BY p.puntaje DESC`,
    [id_partida]
  );
}

// Guarda el puntaje del jugador en SU fila de esa sala (la crea si no existe)
async function guardarPuntaje(id_partida, id_usuario, puntaje, hamburguesas) {
  const filas = await realizarQuery(
    `SELECT id_puntaje, puntaje,
            (fecha >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS del_mes
     FROM PuntajesPartida
     WHERE id_partida = ? AND id_usuario = ?
     ORDER BY id_puntaje ASC
     LIMIT 1`,
    [id_partida, id_usuario]
  );

  if (filas.length === 0) {
    await realizarQuery(
      `INSERT INTO PuntajesPartida (id_partida, id_usuario, puntaje, hamburguesas)
       VALUES (?, ?, ?, ?)`,
      [id_partida, id_usuario, puntaje, hamburguesas]
    );
    return;
  }

  const actual = filas[0];

  if (Number(actual.del_mes) === 1) {
    // Misma partida del mes: se SUMA al puntaje y a las hamburguesas ya guardadas
    await realizarQuery(
      `UPDATE PuntajesPartida
       SET puntaje = puntaje + ?, hamburguesas = hamburguesas + ?, fecha = NOW()
       WHERE id_puntaje = ?`,
      [puntaje, hamburguesas, actual.id_puntaje]
    );
  } else {
    // Lo guardado es de un mes anterior: se arranca de cero con esta partida
    await realizarQuery(
      `UPDATE PuntajesPartida
       SET puntaje = ?, hamburguesas = ?, fecha = NOW()
       WHERE id_puntaje = ?`,
      [puntaje, hamburguesas, actual.id_puntaje]
    );
  }
}

// Quiénes ya mandaron su puntaje en la partida ACTUAL de cada sala (vive en memoria, igual que
// jugadoresEnPartida). Sirve para saber si ya terminaron los dos, también cuando la sala
// vuelve a jugar. id_partida -> { tiempos: Map(id_usuario -> ms), ultimo: ms }
const rondasEnCurso = new Map();

function registrarEnvio(id_partida, id_usuario) {
  const ahora = Date.now();
  let ronda = rondasEnCurso.get(id_partida);

  // El mismo jugador mandando dos veces seguidas (doble envío): no abre una ronda nueva
  if (ronda && ahora - (ronda.tiempos.get(id_usuario) || 0) < 15000) {
    return { repetido: true, completo: ronda.tiempos.size >= 2 };
  }

  // Ronda nueva si no había, si la anterior es muy vieja o si este jugador ya había mandado
  // en la anterior (es decir, la sala volvió a jugar)
  const vieja = !ronda || ahora - ronda.ultimo > VENTANA_RONDA_SEG * 1000;
  if (vieja || ronda.tiempos.has(id_usuario)) {
    ronda = { tiempos: new Map(), ultimo: 0 };
    rondasEnCurso.set(id_partida, ronda);
  }

  ronda.tiempos.set(id_usuario, ahora);
  ronda.ultimo = ahora;
  return { repetido: false, completo: ronda.tiempos.size >= 2 };
}

const rondaCompleta = (id_partida) =>
  (rondasEnCurso.get(id_partida)?.tiempos.size || 0) >= 2;

// Ranking del mes + si los dos jugadores de esta sala ya terminaron
app.get("/api/ranking/:id_partida", async (req, res) => {
  try {
    const id_partida = Number(req.params.id_partida) || 0;
    const ranking = await obtenerRankingMensual();
    res.json({ ok: true, ranking, completo: rondaCompleta(id_partida) });
  } catch (error) {
    console.error("❌ Error al obtener ranking:", error.message);
    res.status(500).json({ ok: false, message: "Error al obtener el ranking" });
  }
});

// Empleado del mes: el primero del ranking (el mayor puntaje de todas las salas)
app.get("/api/empleado-del-mes", async (req, res) => {
  try {
    const ranking = await obtenerRankingMensual();
    res.json({ ok: true, empleado: ranking[0] || null });
  } catch (error) {
    console.error("❌ Error al obtener empleado del mes:", error.message);
    res.status(500).json({ ok: false, message: "Error al obtener el empleado del mes" });
  }
});

const jugadoresEnPartida = [
  {
    //id_partida: 0,
    //jugadores: []
  }
];

// Borra filas de una tabla relacionada con la partida; si la tabla no existe, se ignora
async function borrarRelacionadas(query, params) {
  try {
    await realizarQuery(query, params);
  } catch (error) {
    if (error.code !== "ER_NO_SUCH_TABLE") throw error;
  }
}

// 3. Eliminar una partida (cualquier usuario puede eliminarla)
app.delete("/sala/eliminar-partida/:id_partida", async function (req, res) {
  try {
    const id_partida = Number(req.params.id_partida);
    const id_usuario = Number(req.body?.id_usuario);

    if (!id_partida || !id_usuario) {
      return res.status(400).json({
        ok: false,
        message: "Faltan datos para eliminar la partida.",
      });
    }

    const filas = await realizarQuery(
      "SELECT id_usuario FROM Partidas WHERE id_partida = ?",
      [id_partida]
    );

    if (filas.length === 0) {
      return res.status(404).json({ ok: false, message: "La partida no existe." });
    }

    const enMemoria = jugadoresEnPartida.find((p) => p.id_partida === id_partida);
    if (enMemoria && enMemoria.jugadores.length > 0) {
      return res.status(409).json({
        ok: false,
        message: "No se puede eliminar: hay jugadores adentro de la partida.",
      });
    }

    // Primero lo que depende de la partida (claves foráneas), después la partida
    await borrarRelacionadas("DELETE FROM PuntajesPartida WHERE id_partida = ?", [id_partida]);
    await borrarRelacionadas("DELETE FROM UsuarioXPartida WHERE id_partida = ?", [id_partida]);
    await realizarQuery("DELETE FROM Partidas WHERE id_partida = ?", [id_partida]);

    // Sacar la sala de la memoria del servidor
    const indice = jugadoresEnPartida.findIndex((p) => p.id_partida === id_partida);
    if (indice !== -1) jugadoresEnPartida.splice(indice, 1);

    // Avisar a todos para que actualicen su lista de partidas
    io.emit("salaEliminada", { id_partida });

    return res.json({ ok: true, message: "Partida eliminada." });
  } catch (error) {
    console.error("Error al eliminar la partida:", error.message);
    return res.status(500).json({
      ok: false,
      message: "Error en la base de datos: " + error.message,
    });
  }
});

io.on("connection", (socket) => {

  socket.on("crearSALA", (dataPartida) => {
    // Notifica a todos los usuarios para que ejecuten cargarPartidas()
    io.emit("salaCreada", dataPartida);
  });


  socket.on("unirse_sala", ({ id_partida, id_usuario }) => {
    socket.join(`partida_${id_partida}`);
    socket.data.sala = { id_partida, id_usuario };
    // 1. Buscar si la partida ya existe en el arreglo
    let partida = jugadoresEnPartida.find(p => p.id_partida === id_partida);

    // 2. Si no existe, la creamos y la agregamos al arreglo
    if (!partida) {
      partida = { id_partida: id_partida, jugadores: [] };
      jugadoresEnPartida.push(partida);
    }

    // 3. Evitamos duplicar al usuario
    if (!partida.jugadores.includes(id_usuario)) {
      partida.jugadores.push(id_usuario);
    }

    console.log(`Usuario ${id_usuario} se unió a la partida ${id_partida}`);
    console.log("Estado de salas:", JSON.stringify(jugadoresEnPartida, null, 2));
    console.log("partida.juygadores", partida.jugadores)
    console.log(partida, "partida")
    // Avisar a todos que cambió quién está adentro (para bloquear / liberar el borrado)
    io.emit("salaActualizada", { id_partida });

    // 4. Si hay 2 o más jugadores, iniciar
    if (partida.jugadores.length == 2) {
      io.to(`partida_${id_partida}`).emit("iniciar_partida", {
        id_partida,
        jugadores: partida.jugadores
      });
    }
  });


  socket.on("salir_sala", ({ id_partida, id_usuario }) => {
    socket.leave(`partida_${id_partida}`);
    socket.data.sala = null;

    const partida = jugadoresEnPartida.find(p => p.id_partida === id_partida);

    if (partida) {
      // Filtrar al usuario que sale
      partida.jugadores = partida.jugadores.filter(id => id !== id_usuario);

      // Si la sala queda vacía, eliminar el objeto del arreglo
      if (partida.jugadores.length === 0) {
        const indice = jugadoresEnPartida.findIndex(p => p.id_partida === id_partida);
        if (indice !== -1) {
          jugadoresEnPartida.splice(indice, 1);
        }
      }
    }

    io.emit("salaActualizada", { id_partida });
  });

  // Si alguien cierra la pestaña mientras espera, se libera su lugar
  // (si la sala ya está completa y jugando, se conserva hasta que termine)
  socket.on("disconnect", () => {
    const sala = socket.data.sala;
    if (!sala) return;

    const partida = jugadoresEnPartida.find((p) => p.id_partida === sala.id_partida);
    if (partida && partida.jugadores.length < 2) {
      partida.jugadores = partida.jugadores.filter((id) => id !== sala.id_usuario);
      if (partida.jugadores.length === 0) {
        const indice = jugadoresEnPartida.findIndex((p) => p.id_partida === sala.id_partida);
        if (indice !== -1) jugadoresEnPartida.splice(indice, 1);
      }
      io.emit("salaActualizada", { id_partida: sala.id_partida });
    }
  });

  // El ranking manda el puntaje TOTAL (pedidos + bonus por los segundos que sobraron)
  // y cuántas hamburguesas entregó bien el jugador.
  // Se actualiza SU fila de esa sala en PuntajesPartida y se devuelve el ranking global del mes
  // + si los dos jugadores de esta sala ya terminaron.
  socket.on("enviar_puntaje", async ({ id_partida, id_usuario, puntaje, hamburguesas }, callback) => {
    try {
      const idPartida = Number(id_partida);
      const idUsuario = Number(id_usuario);
      const puntos = Math.max(0, Math.round(Number(puntaje) || 0));
      const cantidadHamburguesas = Math.max(0, Math.round(Number(hamburguesas) || 0));

      if (!idPartida || !idUsuario) {
        return callback?.({ ok: false, msg: "Faltan datos para guardar el puntaje" });
      }

      const { repetido, completo } = registrarEnvio(idPartida, idUsuario);

      if (!repetido) {
        await guardarPuntaje(idPartida, idUsuario, puntos, cantidadHamburguesas);
      }

      const [ranking, rankingSala] = await Promise.all([
        obtenerRankingMensual(),
        obtenerRankingSala(idPartida),
      ]);

      io.to(`partida_${id_partida}`).emit("ranking_actualizado", {
        id_partida,
        ranking: rankingSala,
        completo,
      });

      // Cuando los dos ya mandaron su puntaje la partida terminó: se libera la sala
      if (completo) {
        const indice = jugadoresEnPartida.findIndex((p) => p.id_partida === id_partida);
        if (indice !== -1) {
          jugadoresEnPartida.splice(indice, 1);
          io.emit("salaActualizada", { id_partida });
        }
      }

      callback?.({ ok: true, ranking, completo });
    } catch (error) {
      console.error("❌ Error al guardar puntaje:", error.message);
      callback?.({ ok: false, msg: "Error al guardar el puntaje" });
    }
  });

});