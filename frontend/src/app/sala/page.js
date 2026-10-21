"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";
import Popup from "reactjs-popup";

import Input from "@/components/Input";
import Button from "@/components/Button";
import styles from "./SalaPage.module.css";
import useSocket from "@/hooks/useSocket";

export default function SalaPage() {
  const router = useRouter();
  const { socket, isConnected } = useSocket();
  const [idUsuario, setIdUsuario] = useState(null);
  const [partidas, setPartidas] = useState([]);
  const [partidaSeleccionada, setPartidaSeleccionada] = useState(null);
  const [nombrePartida, setNombrePartida] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [mounted, setMounted] = useState(false);

 /* useEffect(
    ()=>{
      if (!socket) {
        return
      }
      socket.on("salaCreada")
    }, [socket]
  )*/

  useEffect(() => {
    if (!socket) return;

    socket.on("salaCreada", () => {
      cargarPartidas();
    });

    return () => {
      socket.off("salaCreada");
    };
  }, [socket]);

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

  // Escuchar el evento de inicio de partida enviado por el servidor
  useEffect(() => {
    if (!socket) {
        return
      }
    socket.on("iniciar_partida", (data) => {
      console.log("recibii algo")
      // Redirige a ambos usuarios cuando la sala se completa
      router.push(`/partidas?id=${data.id_partida}`);
    });

    return () => {
      socket.off("iniciar_partida");
    };
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

  // Función al hacer click sobre una partida de la lista
  function seleccionarPartida(partida) {
    if (partidaSeleccionada && idUsuario) {
      // Notificar salida de la partida anterior si ya había seleccionado una
      socket.emit("salir_sala", {
        id_partida: partidaSeleccionada.id_partida,
        id_usuario: idUsuario,
      });
    }

    setPartidaSeleccionada(partida);

    if (idUsuario) {
      // Notificar al servidor que el usuario eligió esta partida
      socket.emit("unirse_sala", {
        id_partida: partida.id_partida,
        id_usuario: idUsuario,
      });
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
        headers: { "Content-Type": "application/json" },
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

      // Emitir el evento por socket
      if (socket) {
        socket.emit("crearSALA", {
          id_partida: data.id_partida,
          nombre_partida: nombrePartida,
          id_usuario: idUsuario,
        });
      }

      setNombrePartida("");
      await cargarPartidas();

      if (!respuesta.ok || !data.ok) {
        setMensaje(data.message || "Error al crear la partida.");
        return;
      }

      setNombrePartida("");
      await cargarPartidas();

      if (closeModal) closeModal();
    } catch (error) {
      console.error(error);
      setMensaje("Error al conectar con el servidor.");
    }
  }

  if (!mounted) return null;

  return (
    <div className={styles.salaContainer}>
      <div className={styles.header}>
        <h1 className={styles.title}>Salas de Juego</h1>
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

      <div>
        <Popup
          trigger={<button className={styles.btnPrimary}>+ Crear nueva partida</button>}
          modal
          nested
          overlayClassName={styles.modalOverlay}
          contentStyle={{ background: "transparent", border: "none", width: "auto" }}
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
                <Button text="Crear partida" type="button" onClick={() => crearPartida(close)} />
                <button className={styles.btnDanger} onClick={close}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </Popup>
      </div>

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
                  onClick={() => seleccionarPartida(partida)}
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

      <div className={styles.cardPanel}>
        {partidaSeleccionada ? (
          <div>
            <h2>En la partida: {partidaSeleccionada.nombre_partida}</h2>
            <p>ID Partida: {partidaSeleccionada.id_partida}</p>
            <p style={{ color: "#e67e22" }}>Esperando a que se una otro jugador...</p>
          </div>
        ) : (
          <p>Seleccione una partida de la lista para ingresar.</p>
        )}
      </div>
    </div>
  );
}