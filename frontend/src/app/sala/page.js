"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Popup from "reactjs-popup";

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
  const [modoEliminar, setModoEliminar] = useState(false);
  const [idsAEliminar, setIdsAEliminar] = useState([]);

  useEffect(() => {
    if (!socket) return;

    socket.on("salaCreada", () => {
      cargarPartidas();
    });

    // Alguien entró o salió de una partida: se actualiza quién está ocupada
    socket.on("salaActualizada", () => {
      cargarPartidas();
    });

    // Se eliminó una partida: se actualiza la lista
    socket.on("salaEliminada", ({ id_partida }) => {
      cargarPartidas();
      setPartidaSeleccionada((actual) =>
        actual && actual.id_partida === id_partida ? null : actual
      );
      setIdsAEliminar((ids) => ids.filter((id) => id !== id_partida));
    });

    return () => {
      socket.off("salaCreada");
      socket.off("salaEliminada");
      socket.off("salaActualizada");
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
      return;
    }
    socket.on("iniciar_partida", (data) => {
      console.log("recibii algo");
      // Guardamos el id de la partida para que la página de ranking lo encuentre
      sessionStorage.setItem("id_partida", String(data.id_partida));
      localStorage.setItem("id_partida", String(data.id_partida));
      // Redirige a ambos usuarios cuando la sala se completa
      router.push(`/partidas?id=${data.id_partida}`);
    });

    return () => {
      socket.off("iniciar_partida");
    };
  }, [socket]);

  // Si una partida marcada se ocupa mientras tanto, se desmarca
  useEffect(() => {
    setIdsAEliminar((ids) =>
      ids.filter((id) => {
        const p = partidas.find((x) => x.id_partida === id);
        return p && !p.ocupada;
      })
    );
  }, [partidas]);

  async function cargarPartidas() {
    try {
      const respuesta = await fetch("http://localhost:4000/sala/partidas"
);
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

  // Activar / desactivar el modo "eliminar partidas"
  function alternarModoEliminar() {
    if (!modoEliminar && partidaSeleccionada && idUsuario) {
      // Se sale de la partida que se había elegido para no iniciar un juego sin querer
      socket?.emit("salir_sala", {
        id_partida: partidaSeleccionada.id_partida,
        id_usuario: idUsuario,
      });
      setPartidaSeleccionada(null);
    }
    setIdsAEliminar([]);
    setModoEliminar((actual) => !actual);
  }

  // Marcar / desmarcar una partida para eliminarla
  function alternarMarca(partida) {
    setIdsAEliminar((ids) =>
      ids.includes(partida.id_partida)
        ? ids.filter((id) => id !== partida.id_partida)
        : [...ids, partida.id_partida]
    );
  }

  // Eliminar todas las partidas marcadas
  async function eliminarSeleccionadas() {
    if (idsAEliminar.length === 0 || !idUsuario) return;

    const confirmar = window.confirm(
      idsAEliminar.length === 1
        ? "¿Eliminar la partida seleccionada? Esta acción no se puede deshacer."
        : `¿Eliminar las ${idsAEliminar.length} partidas seleccionadas? Esta acción no se puede deshacer.`
    );
    if (!confirmar) return;

    const resultados = await Promise.all(
      idsAEliminar.map(async (id) => {
        try {
          const respuesta = await fetch(
            `http://localhost:4000/sala/eliminar-partida/${id}`,
            {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id_usuario: Number(idUsuario) }),
            }
          );
          const data = await respuesta.json();
          return respuesta.ok && data.ok ? null : data.message || "Error";
        } catch (error) {
          console.error("Error al eliminar la partida:", error);
          return "Error al conectar con el servidor.";
        }
      })
    );

    const errores = resultados.filter(Boolean);
    if (errores.length > 0) {
      alert(
        `No se pudieron eliminar ${errores.length} partida(s): ${errores[0]}`
      );
    }

    setIdsAEliminar([]);
    setModoEliminar(false);
    await cargarPartidas();
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
      const respuesta = await fetch("http://localhost:4000/sala/crear-partida"
, {
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
        <button
          className={styles.btnLogout}
          onClick={() => {
            localStorage.removeItem("usuario");
            router.push("/");
          }}
        >
          Cerrar sesión
        </button>
      </div>

      <main className={styles.paper}>
        <div className={styles.pin}>
          {/* Página izquierda */}
          <section className={styles.left}>
            <div>
              <h1 className={styles.title}>PARTIDAS</h1>
              <div className={styles.tag}>Elegí una y sentate</div>
            </div>

            <div className={styles.special}>
              <div>
                <small className={styles.specialLabel}>Especial de la casa</small>
                <strong className={styles.specialTitle}>Armá tu propia partida</strong>
              </div>

              <Popup
                trigger={<button className={styles.btn}>Crear partida</button>}
                modal
                nested
                overlayClassName={styles.modalOverlay}
                contentStyle={{ background: "transparent", border: "none", width: "auto" }}
              >
                {(close) => (
                  <div className={styles.modalContent}>
                    <form
                      className={styles.modalForm}
                      onSubmit={(e) => {
                        e.preventDefault();
                        crearPartida(close);
                      }}
                    >
                      <h2 className={styles.modalTitle}>NUEVA PARTIDA</h2>

                      <div>
                        <label htmlFor="nombrePartida" className={styles.modalLabel}>
                          Nombre de la partida
                        </label>
                        <input
                          id="nombrePartida"
                          type="text"
                          autoFocus
                          className={styles.modalInput}
                          value={nombrePartida}
                          onChange={(e) => setNombrePartida(e.target.value)}
                          placeholder="Ej: Sala de Entrenamiento"
                        />
                      </div>

                      {mensaje && (
                        <p className={styles.modalError} role="alert">
                          {mensaje}
                        </p>
                      )}

                      <div className={styles.modalActions}>
                        <button type="submit" className={styles.btn}>
                          Crear partida
                        </button>
                        <button type="button" className={styles.btnGhost} onClick={close}>
                          Cancelar
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </Popup>

              <button
                type="button"
                className={styles.btnGhost}
                onClick={alternarModoEliminar}
              >
                {modoEliminar ? "Cancelar" : "Eliminar partidas"}
              </button>
            </div>

            <svg className={styles.burger} viewBox="0 0 160 124" aria-hidden="true">
              <g stroke="#842f32" strokeWidth="3" strokeLinejoin="round">
                <path d="M20 52 Q20 12 80 12 Q140 12 140 52 Z" fill="#e8b02f" />
                <rect x="18" y="84" width="124" height="14" rx="7" fill="#6b3a22" />
                <path d="M20 102 H140 Q140 118 80 118 Q20 118 20 102 Z" fill="#e8b02f" />
              </g>
              <path
                d="M18 60 q8 10 16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t12 0"
                stroke="#6fae3e"
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
              />
              <polygon
                points="22,70 138,70 126,82 100,74 80,88 60,74 34,82"
                fill="#e58a2a"
              />
              <g fill="#fbf1dc">
                <ellipse cx="58" cy="30" rx="4" ry="2.4" />
                <ellipse cx="80" cy="24" rx="4" ry="2.4" />
                <ellipse cx="102" cy="31" rx="4" ry="2.4" />
                <ellipse cx="70" cy="40" rx="4" ry="2.4" />
                <ellipse cx="92" cy="41" rx="4" ry="2.4" />
              </g>
            </svg>
          </section>

          {/* Página derecha */}
          <section className={styles.right}>
            <div className={styles.sec}>
              <h2 className={styles.secTitle}>Disponibles</h2>
              <i className={styles.secLine} />
              <span className={styles.secCount}>{partidas.length} en la barra</span>
              {modoEliminar && (
                <button
                  type="button"
                  className={styles.btnCerrar}
                  onClick={alternarModoEliminar}
                  aria-label="Salir de eliminar partidas"
                  title="Salir de eliminar partidas"
                >
                  ✕
                </button>
              )}
            </div>

            <div className={styles.scroll}>
              {partidas.length === 0 ? (
                <p className={styles.empty}>No hay partidas activas en este momento.</p>
              ) : (
                <ul className={styles.menu}>
                  {partidas.map((partida) => {
                    const esSeleccionada =
                      !modoEliminar &&
                      partidaSeleccionada?.id_partida === partida.id_partida;
                    const marcada = idsAEliminar.includes(partida.id_partida);
                    const bloqueada = modoEliminar && partida.ocupada;

                    return (
                      <li key={partida.id_partida} className={styles.menuItem}>
                        <button
                          type="button"
                          aria-pressed={modoEliminar ? marcada : esSeleccionada}
                          disabled={bloqueada}
                          onClick={() =>
                            modoEliminar
                              ? alternarMarca(partida)
                              : seleccionarPartida(partida)
                          }
                          className={`${styles.row} ${
                            esSeleccionada ? styles.partidaSeleccionada : ""
                          } ${marcada ? styles.partidaMarcada : ""} ${
                            bloqueada ? styles.partidaBloqueada : ""
                          }`}
                        >
                          {modoEliminar && (
                            <span
                              className={`${styles.check} ${
                                marcada ? styles.checkMarcado : ""
                              }`}
                              aria-hidden="true"
                            >
                              {marcada ? "✓" : ""}
                            </span>
                          )}
                          <span className={styles.name}>{partida.nombre_partida}</span>
                          <span className={styles.dots} />
                          <span>
                            {bloqueada
                              ? "Jugadores adentro"
                              : partida.creador_nombre || "Usuario " + partida.id_usuario}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className={styles.dock}>
              {modoEliminar ? (
                <div className={styles.dockFila}>
                  <div>
                    <p className={styles.dockMain}>
                      Tocá las partidas que querés eliminar.
                    </p>
                    <p className={styles.dockSub}>
                      {idsAEliminar.length === 0
                        ? "Las partidas con jugadores adentro no se pueden eliminar."
                        : `${idsAEliminar.length} seleccionada(s).`}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={styles.btnEliminar}
                    onClick={eliminarSeleccionadas}
                    disabled={idsAEliminar.length === 0}
                  >
                    Eliminar
                  </button>
                </div>
              ) : partidaSeleccionada ? (
                <div>
                  <p className={styles.dockMain}>
                    En la partida: <strong>{partidaSeleccionada.nombre_partida}</strong>
                  </p>
                  <p className={styles.dockSub}>
                    ID de partida: {partidaSeleccionada.id_partida}. Esperando a que se una
                    otro jugador…
                  </p>
                </div>
              ) : (
                <p className={styles.dockMain}>
                  Seleccioná una partida de la lista para ingresar.
                </p>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}