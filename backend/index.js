const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");
const { realizarQuery } = require("./modulos/mysql");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

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

const jugadoresEnPartida = [];

const elegir = (lista) => lista[Math.floor(Math.random() * lista.length)];

// LOGIN 
app.post("/login", async function (req, res) {
  try {
    let respuesta = {
      ok: false,
      msg: "¿No tienes cuenta? Regístrate aquí",
    };
    let existe = await realizarQuery(`
      SELECT * FROM Usuarios WHERE mail = '${req.body.mail}' AND contra = '${req.body.contra}'
    `);

    if (existe.length > 0) {
      respuesta.msg = "El usuario existe.";
      respuesta.ok = true;
    }
    return res.send({ respuesta, existe });
  } catch (error) {
    console.log(error.message);
    res.send({ message: "usuario no existe registrate", ok: false });
  }
});


// Configuración del juego
const CONFIG_JUEGO = {
  tiempoPartida: 135,     
  maxHamburguesas: 2,    
  maxMilkshakes: 2,      
  maxFritos: 2,          
  tiempoFrituraMs: 5000, 

  // Page /parrilla 
  parrilla: {
    coccion: { paty: 6, pollo: 6, veggie: 4 }, 
    gracia: 3.5,           
    duracionVolteo: 0.8,   
    esperaCocinada: 1.8,   
    esperaQuemada: 2.6,    
  },
  // Los ids de /freidora
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

const rutaImagenJuego = (tipo) => {
  if (!tipo) return '';
  const t = String(tipo);
  return /^(\/|https?:|data:)/.test(t) ? t : `/${t}`;
};

// Solo decoración para el ticket 
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

// Todos los ingredientes 
app.get('/api/ingredientes', async (req, res) => {
  try {
    const ingredientes = await realizarQuery('SELECT * FROM Ingredientes');
    res.json(ingredientes);
  } catch (error) {
    console.error("❌ Error al consultar ingredientes:", error);
    res.status(500).json({ error: "Error al obtener ingredientes de MySQL" });
  }
});

// Receta de hamburguesa ALEATORIA (page partidas)
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
      relleno.push(elegir(rellenosPosibles));
    }

    res.json([panInf, ...relleno, panSup]);
  } catch (error) {
    console.error("❌ Error al generar receta:", error);
    res.status(500).json({ error: "Error interno al generar receta" });
  }
});

// Configuración del juego (pages partidas, parrilla y freidora)
app.get('/api/config-juego', (req, res) => {
  res.json(CONFIG_JUEGO);
});

// Sabores de milkshake disponibles (page partidas)
app.get('/api/milkshakes', async (req, res) => {
  try {
    const ingredientes = await realizarQuery('SELECT * FROM Ingredientes');
    res.json(armarSabores(ingredientes));
  } catch (error) {
    console.error('❌ Error al obtener milkshakes:', error);
    res.status(500).json({ error: 'Error al obtener los milkshakes de MySQL' });
  }
});

// Cosas de la freidora 
app.get('/api/fritos', async (req, res) => {
  try {
    const ingredientes = await realizarQuery('SELECT * FROM Ingredientes');
    res.json(armarFritos(ingredientes));
  } catch (error) {
    console.error('❌ Error al obtener fritos:', error);
    res.status(500).json({ error: 'Error al obtener los fritos de MySQL' });
  }
});

// Milkshakes y fritos ALEATORIOS para un pedido nuevo (page partidas):
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

app.get('/api/bandejas', async (req, res) => {
  try {
    const filas = await realizarQuery(
      'SELECT id_ingrediente, codigo, pos_left, pos_top, pos_width, pos_height FROM Bandejas'
    );
  
    res.json(
      filas.map((f) => ({
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

// SALAS  
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

// Crear una nueva partida
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

    const resultado = await realizarQuery(`
      INSERT INTO Partidas (id_usuario, nombre_partida, hora_final)
      VALUES (${id_usuario_creador}, '${nombre_partida}', '${hora_final}')
    `);

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

async function borrarRelacionadas(query, params) {
  try {
    await realizarQuery(query, params);
  } catch (error) {
    if (error.code !== "ER_NO_SUCH_TABLE") throw error;
  }
}

// Eliminar una partida (cualquier usuario puede eliminarla)
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

// RANKING  
const VENTANA_RONDA_SEG = 240;

async function obtenerRanking() {
  const filas = await realizarQuery(
    `SELECT u.id_usuario, u.nombre,
            SUM(p.puntaje) AS puntaje,
            SUM(p.hamburguesas) AS hamburguesas
     FROM PuntajesPartida p
     JOIN Usuarios u ON u.id_usuario = p.id_usuario
     GROUP BY u.id_usuario, u.nombre
     ORDER BY SUM(p.puntaje) DESC, SUM(p.hamburguesas) DESC, u.id_usuario ASC`
  );

  return filas.map((f) => ({
    id_usuario: f.id_usuario,
    nombre: f.nombre,
    puntaje: Number(f.puntaje),
    hamburguesas: Number(f.hamburguesas),
  }));
}

async function guardarPuntaje(id_partida, id_usuario, puntaje, hamburguesas) {
  const filas = await realizarQuery(
    `SELECT id_puntaje
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

  await realizarQuery(
    `UPDATE PuntajesPartida
     SET puntaje = puntaje + ?, hamburguesas = hamburguesas + ?
     WHERE id_puntaje = ?`,
    [puntaje, hamburguesas, filas[0].id_puntaje]
  );
}

const rondasEnCurso = new Map();

function registrarEnvio(id_partida, id_usuario) {
  const ahora = Date.now();
  let ronda = rondasEnCurso.get(id_partida);

  if (ronda && ahora - (ronda.tiempos.get(id_usuario) || 0) < 15000) {
    return { repetido: true, completo: ronda.tiempos.size >= 2 };
  }

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

// Ranking + si los dos jugadores de esta sala ya terminaron
app.get("/api/ranking/:id_partida", async (req, res) => {
  try {
    const id_partida = Number(req.params.id_partida) || 0;
    const ranking = await obtenerRanking();
    res.json({ ok: true, ranking, completo: rondaCompleta(id_partida) });
  } catch (error) {
    console.error("❌ Error al obtener ranking:", error.message);
    res.status(500).json({ ok: false, message: "Error al obtener el ranking" });
  }
});

app.get("/api/empleado-del-mes", async (req, res) => {
  try {
    const ranking = await obtenerRanking();
    res.json({ ok: true, empleado: ranking[0] || null });
  } catch (error) {
    console.error("❌ Error al obtener empleado del mes:", error.message);
    res.status(500).json({ ok: false, message: "Error al obtener el empleado del mes" });
  }
});

// SOCKET.IO  (un solo manejador de conexión)
io.on("connection", (socket) => {

  // registro
  socket.on("register", async (data, callback) => {
    try {
      // Verificar si el usuario o mail ya existe
      let existe = await realizarQuery(`
        SELECT * FROM Usuarios WHERE nombre = '${data.nombre}' OR mail = '${data.mail}'
      `);

      if (existe.length > 0) {
        return callback({
          ok: false,
          msg: "El nombre de usuario o el email ya están en uso."
        });
      }

      await realizarQuery(`
        INSERT INTO Usuarios (nombre, contra, mail) VALUES
        ('${data.nombre}', '${data.contra}', '${data.mail}');
      `);

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

  //salas
  socket.on("crearSALA", (dataPartida) => {
    io.emit("salaCreada", dataPartida);
  });

  socket.on("unirse_sala", ({ id_partida, id_usuario }) => {
    socket.join(`partida_${id_partida}`);
    socket.data.sala = { id_partida, id_usuario };

    let partida = jugadoresEnPartida.find(p => p.id_partida === id_partida);
    if (!partida) {
      partida = { id_partida, jugadores: [] };
      jugadoresEnPartida.push(partida);
    }
  
    if (!partida.jugadores.includes(id_usuario)) {
      partida.jugadores.push(id_usuario);
    }

    io.emit("salaActualizada", { id_partida });

    if (partida.jugadores.length === 2) {
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
      partida.jugadores = partida.jugadores.filter(id => id !== id_usuario);

      if (partida.jugadores.length === 0) {
        const indice = jugadoresEnPartida.findIndex(p => p.id_partida === id_partida);
        if (indice !== -1) jugadoresEnPartida.splice(indice, 1);
      }
    }

    io.emit("salaActualizada", { id_partida });
  });
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

  //Ranking 
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

      const ranking = await obtenerRanking();

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