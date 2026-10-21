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
    origin: ["http://localhost:3000", "http://localhost:3001"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
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










// CREACION DE SALAS - NO BORRAR

// LISTADO DE CHATS INDIVIDUALES:
/*app.get("/sala/:id_usuario", async function (req, res) {
  try {
    const { id_usuario } = req.params;

    const chats = await realizarQuery(
      `
      SELECT 
        c.id_chat,
        u_otro.nombre AS nombre_contacto
      FROM UsuariosEnChat uec
      JOIN Chats c 
        ON uec.id_chat = c.id_chat
      LEFT JOIN Usuarios u_otro
        ON u_otro.id_usuario = (
          SELECT uec_sub.id_usuario 
          FROM UsuariosEnChat uec_sub
          WHERE uec_sub.id_chat = c.id_chat 
            AND uec_sub.id_usuario != ${id_usuario}
          LIMIT 1
        )
      WHERE uec.id_usuario = ${id_usuario}
      `
    );

    res.send({
      ok: true,
      chats,
    });
  } catch (error) {
    res.status(500).send({
      message: "Error al listar chats",
      error: error.message,
    });
  }
});


// CREACION DE CHAT INDIVIDUAL:
app.post("/sala/individual", async function (req, res) {
  try {
    const { id_usuario_creador, correo_destinatario } = req.body;

    const destinatarios = await realizarQuery(
      `SELECT id_usuario FROM Usuarios WHERE mail = "${correo_destinatario}"`
    );

    if (destinatarios.length === 0) {
      return res.status(404).send({
        message: "El usuario destinatario no existe"
      });
    }

    const id_destinatario = destinatarios[0].id_usuario;

    if (Number(id_usuario_creador) === Number(id_destinatario)) {
      return res.status(400).send({
        message: "No puedes crear un chat individual contigo mismo"
      });
    }

    const resultadoChat = await realizarQuery(
      `INSERT INTO Chats VALUES ()`
    );
    const id_chat = resultadoChat.insertId;

    await realizarQuery(
      `INSERT INTO UsuariosEnChat (id_chat, id_usuario) VALUES (${id_chat}, ${id_usuario_creador})`
    );

    // 3. ¡IMPORTANTE! Insertar también al usuario destinatario en el chat
    await realizarQuery(
      `INSERT INTO UsuariosEnChat (id_chat, id_usuario) VALUES (${id_chat}, ${id_destinatario})`
    );

    res.send({
      ok: true,
      message: "Chat individual creado con éxito",
      id_chat
    });
  } catch (error) {
    res.status(500).send({
      message: "Error al crear chat individual",
      error: error.message
    });
  }
});*/

app.get("/sala/partidas", async function (req, res) {
  try {
    const partidas = await realizarQuery(`
      SELECT 
        p.id_partida,
        p.nombre_partida,
        p.id_usuario,
        p.hora_final,
        p.ranking,
        u.nombre AS creador_nombre
      FROM Partidas p
      LEFT JOIN Usuarios u ON p.id_usuario = u.id_usuario
    `);
    
    return res.json({ ok: true, partidas });
  } catch (error) {
    console.error("Error al obtener partidas:", error.message);
    return res.status(500).json({ ok: false, message: error.message });
  }
});

// 2. Crear una nueva partida
app.post("/sala/crear-partida", async function (req, res) {
  try {
    const { id_usuario_creador, nombre_partida, ranking } = req.body;

    // Validación de ID de usuario
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

    // Generar formato DATETIME válido para MySQL (YYYY-MM-DD HH:MM:SS)
    const hora_final = new Date(Date.now() + 3600000)
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");
    const valRanking = ranking || 0;  
    const query = `
      INSERT INTO Partidas (id_usuario, nombre_partida, hora_final, ranking) 
      VALUES (${id_usuario_creador}, '${nombre_partida}', '${hora_final}', ${valRanking})
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
 