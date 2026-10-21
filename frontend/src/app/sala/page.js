/*"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Popup from "reactjs-popup";

import Input from "@/components/Input";
import Button from "@/components/Button";

export default function SalaPage() {
  const router = useRouter();

  const [idUsuario, setIdUsuario] = useState(null);
  const [chats, setChats] = useState([]);
  const [chatSeleccionado, setChatSeleccionado] = useState(null);

  const [correo, setCorreo] = useState("");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    const user = localStorage.getItem("usuario");
    const objUser = JSON.parse(user);
    console.log(objUser)
    console.log(objUser.id_usuario)
    if (!objUser) {
      //router.push("/");
      return;
    }

    setIdUsuario(objUser.id_usuario);
    cargarChats(objUser.id_usuario);
  }, []);

  async function cargarChats(id) {
    try {
      // CORREGIDO: Apunta correctamente a la ruta /sala/:id
      const respuesta = await fetch(
        `http://localhost:4000/sala/${id}`
      );

      const data = await respuesta.json();
      console.log(data)
      if (data.ok) {
        setChats(data.chats);
      }
    } catch (error) {
      console.error("Error al cargar chats:", error);
    }
  }

  function seleccionarChat(chat) {
    // Mantiene al usuario en la misma página y selecciona el chat actual
    setChatSeleccionado(chat);
  }

  async function crearChat() {
    setMensaje("");

    if (!correo) {
      setMensaje("Ingresá un correo.");
      return;
    }

    try {
      // CORREGIDO: Apunta correctamente a la ruta /sala/individual
      const respuesta = await fetch(
        "http://localhost:4000/sala/individual",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id_usuario_creador: Number(idUsuario),
            correo_destinatario: correo,
          }),
        }
      );

      const data = await respuesta.json();

      if (!respuesta.ok) {
        setMensaje(data.message);
        return;
      }

      setCorreo("");
      await cargarChats(idUsuario);

      alert("Chat creado correctamente.");
    } catch (error) {
      console.error(error);
      setMensaje("Error al crear el chat.");
    }
  }

  return (
    <>
      <div>
        <div>
          <h1>Mis chats</h1>

          <button
            onClick={() => {
              localStorage.removeItem("Usuarios");
              router.push("/");
            }}
          >
            Cerrar sesión
          </button>
        </div>

        <div>
          {/* Popup para Nuevo Chat Individua}
          <Popup
            trigger={
              <button>
                + Nuevo chat
              </button>
            }
            modal
            nested
          >
            {(close) => (
              <div>
                <h2>Nuevo chat</h2>

                  <Input
                  label="Correo del usuario"
                  type="email"
                  value={correo}
                  onChange={(e) =>
                    setCorreo(e.target.value)
                  }
                  placeholder="correo@ejemplo.com"
                />

                {mensaje && (
                  <p>
                    {mensaje}
                  </p>
                )}

                <Button
                  text="Crear chat"
                  type="button"
                  onClick={() => {
                    crearChat();
                    close();
                  }}
                />

                <button onClick={close}>
                  Cancelar
                </button>
              </div>
            )}
          </Popup>
        </div>

        {/* Lista de chats integrada directamente }
        <div>
          {chats.length === 0 ? (
            <p>No tenés chats activos.</p>
          ) : (
            chats.map((chat) => (
              <div
                key={chat.id_chat}
                onClick={() => seleccionarChat(chat)}
                style={{ cursor: "pointer", padding: "10px", borderBottom: "1px solid #ccc" }}
              >
                <h3>{chat.nombre_contacto || "Chat sin nombre"}</h3>
              </div>
            ))
          )}
        </div>

        {/* Sección donde se conectan los dos usuarios dentro de la sala}
        <div style={{ marginTop: "20px", border: "1px solid #ddd", padding: "15px" }}>
          {chatSeleccionado ? (
            <div>
              <h2>Chateando con: {chatSeleccionado.nombre_contacto}</h2>
              <p>ID del chat activo: {chatSeleccionado.id_chat}</p>
              {/* Aquí puedes colocar los mensajes o la lógica de socket/comunicación entre ambos usuarios }
            </div>
          ) : (
            <p>Seleccioná un chat de la lista para comenzar a hablar.</p>
          )}
        </div>

      </div>
    </>
  );
}*/

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Popup from "reactjs-popup";

import Input from "@/components/Input";
import Button from "@/components/Button";

// Importa los estilos CSS aquí (ajusta la ruta según donde guardes el archivo)
import styles from "./SalaPage.module.css";

export default function SalaPage() {
  const router = useRouter();

  const [idUsuario, setIdUsuario] = useState(null);
  const [partidas, setPartidas] = useState([]);
  const [partidaSeleccionada, setPartidaSeleccionada] = useState(null);

  const [nombrePartida, setNombrePartida] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const userStr = localStorage.getItem("usuario");
    if (!userStr) {
      router.push("/");
      return;
    }

    const objUser = JSON.parse(userStr);
    const userId = objUser.id_usuario || objUser.id;
    if (userId) {
      setIdUsuario(userId);
    }

    cargarPartidas();
  }, [router]);

  async function cargarPartidas() {
    try {
      const respuesta = await fetch("http://localhost:4000/sala/partidas");
      if (!respuesta.ok) return;

      const data = await respuesta.json();
      if (data.ok) {
        setPartidas(data.partidas);
      }
    } catch (error) {
      console.error("Error al cargar partidas:", error);
    }
  }

  async function crearPartida(closeModal) {
    setMensaje("");

    if (!nombrePartida.trim()) {
      setMensaje("Ingresá un nombre para la partida.");
      return;
    }

    if (!idUsuario) {
      setMensaje("No se pudo obtener tu sesión. Inicia sesión de nuevo.");
      return;
    }

    try {
      const respuesta = await fetch("http://localhost:4000/sala/crear-partida", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id_usuario_creador: Number(idUsuario),
          nombre_partida: nombrePartida,
          ranking: 0,
        }),
      });

      const data = await respuesta.json();

      if (!respuesta.ok || !data.ok) {
        setMensaje(data.message || "Error al crear la partida.");
        return;
      }

      setNombrePartida("");
      await cargarPartidas();

      if (closeModal) {
        closeModal();
      }
    } catch (error) {
      console.error(error);
      setMensaje("Error al conectar con el servidor.");
    }
  }

  if (!mounted) {
    return null;
  }

  return (
    <div className={styles.salaContainer}>
      {/* Encabezado */}
      <div className={styles.header}>
        {<h1 className={styles.title}>Salas de Juego</h1>}

        <button
          className={styles.btnDanger}
          onClick={() => {
            localStorage.removeItem("usuario");
            router.push("/");
          }}
        >
          Cerrar sesión
        </button>
      </div>

      {/* Botón para abrir modal */}
      <div>
        <Popup
          trigger={<button className={styles.btnPrimary}>+ Crear nueva partida</button>}
          modal
          nested
          overlayClassName={styles.modalOverlay}
          contentStyle={{ background: 'transparent', border: 'none', width: 'auto' }}
        >
          {(close) => (
            <div className={styles.modalContent}>
              <h2>Nueva partida</h2>

              <Input
                label="Nombre de la partida"
                type="text"
                value={nombrePartida}
                onChange={(e) => setNombrePartida(e.target.value)}
                placeholder="Ej: Sala de Entrenamiento"
              />

              {mensaje && <p style={{ color: "#ff5252", fontWeight: "bold" }}>{mensaje}</p>}

              <div className={styles.modalActions}>
                <Button
                  text="Crear partida"
                  type="button"
                  onClick={() => crearPartida(close)}
                />
                <button className={styles.btnDanger} onClick={close}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </Popup>
      </div>

      {/* Lista de partidas disponibles */}
      <div className={styles.cardPanel}>
        <h2>Partidas disponibles</h2>
        {partidas.length === 0 ? (
          <p>No hay partidas activas en este momento.</p>
        ) : (
          <div className={styles.partidasList}>
            {partidas.map((partida) => {
              const esSeleccionada =
                partidaSeleccionada?.id_partida === partida.id_partida;

              return (
                <div
                  key={partida.id_partida}
                  onClick={() => setPartidaSeleccionada(partida)}
                  className={`${styles.partidaItem} ${
                    esSeleccionada ? styles.partidaSeleccionada : ""
                  }`}
                >
                  <h3>{partida.nombre_partida}</h3>
                  <p>
                    Creador: {partida.creador_nombre || "Usuario " + partida.id_usuario}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detalle de la partida seleccionada */}
      <div className={styles.cardPanel}>
        {partidaSeleccionada ? (
          <div>
            <h2>En la partida: {partidaSeleccionada.nombre_partida}</h2>
            <p>ID Partida: {partidaSeleccionada.id_partida}</p>
          </div>
        ) : (
          <p>Seleccione una partida de la lista para ingresar.</p>
        )}
      </div>
    </div>
  );
}