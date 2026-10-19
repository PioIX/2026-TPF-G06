"use client";

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
          {/* Popup para Nuevo Chat Individual */}
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

        {/* Lista de chats integrada directamente */}
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

        {/* Sección donde se conectan los dos usuarios dentro de la sala */}
        <div style={{ marginTop: "20px", border: "1px solid #ddd", padding: "15px" }}>
          {chatSeleccionado ? (
            <div>
              <h2>Chateando con: {chatSeleccionado.nombre_contacto}</h2>
              <p>ID del chat activo: {chatSeleccionado.id_chat}</p>
              {/* Aquí puedes colocar los mensajes o la lógica de socket/comunicación entre ambos usuarios */}
            </div>
          ) : (
            <p>Seleccioná un chat de la lista para comenzar a hablar.</p>
          )}
        </div>

      </div>
    </>
  );
}