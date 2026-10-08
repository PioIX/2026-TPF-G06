"use client";

import { useState } from "react";
import Popup from "reactjs-popup";
import "reactjs-popup/dist/index.css";
import Input from "./Input";
import Button from "./Button";

export default function NewChatPopup({ idUsuario, onChatCreated }) {
  const [esGrupal, setEsGrupal] = useState(false);
  const [mail, setMail] = useState("");
  const [nombreGrupo, setNombreGrupo] = useState("");
  const [mailsGrupo, setMailsGrupo] = useState("");
  const [fotoGrupo, setFotoGrupo] = useState("");
  const [error, setError] = useState("");

  const resetForm = () => {
    setMail("");
    setNombreGrupo("");
    setMailsGrupo("");
    setFotoGrupo("");
    setError("");
  };

  const handleCrearChatIndividual = async (close) => {
    setError("");
    if (!mail.trim()) return setError("Ingresá un mail válido.");

    try {
      const res = await fetch("http://localhost:4000/chatIndividual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_usuario: idUsuario, mail: mail.trim() }),
      });
      const data = await res.json();

      if (res.ok && data.ok) {
        onChatCreated();
        resetForm();
        close();
      } else {
        setError(data.message || data.error || "El usuario no existe.");
      }
    } catch (err) {
      setError("Error al conectar con el servidor.");
    }
  };

  const handleCrearGrupo = async (close) => {
    setError("");
    if (!nombreGrupo.trim() || !mailsGrupo.trim()) {
      return setError("Completá el nombre del grupo y los emails.");
    }

    const emailsArray = mailsGrupo.split(",").map((e) => e.trim());

    try {
      const res = await fetch("http://localhost:4000/chatGrupal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_creador: idUsuario,
          mails: emailsArray,
          nombre_grupal: nombreGrupo,
          foto_grupo: fotoGrupo || "/default-group.png",
        }),
      });
      const data = await res.json();

      if (res.ok && data.ok) {
        onChatCreated();
        resetForm();
        close();
      } else {
        setError(data.msg || "Uno o más emails no existen.");
      }
    } catch (err) {
      setError("Error al conectar con el servidor.");
    }
  };

  return (
    <Popup
      trigger={<Button className="text-xs font-semibold">+ Nuevo Chat</Button>}
      modal
      nested
      onClose={resetForm}
    >
      {(close) => (
        <div className="p-4 space-y-4 text-black">
          {/* Pestañas para cambiar entre Individual y Grupal */}
          <div className="flex border-b pb-2 gap-4">
            <button
              type="button"
              onClick={() => { setEsGrupal(false); setError(""); }}
              className={`font-bold text-sm ${!esGrupal ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500"}`}
            >
              Chat Individual
            </button>
            <button
              type="button"
              onClick={() => { setEsGrupal(true); setError(""); }}
              className={`font-bold text-sm ${esGrupal ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500"}`}
            >
              Nuevo Grupo
            </button>
          </div>

          {error && <p className="text-red-500 text-xs font-semibold">{error}</p>}

          {!esGrupal ? (
            /* Formulario Chat Individual */
            <div className="space-y-3">
              <Input
                placeholder="Mail del contacto"
                value={mail}
                onChange={(e) => setMail(e.target.value)}
              />
              <Button onClick={() => handleCrearChatIndividual(close)} className="w-full">
                Crear Chat
              </Button>
            </div>
          ) : (
            /* Formulario Chat Grupal */
            <div className="space-y-3">
              <Input
                placeholder="Nombre del Grupo"
                value={nombreGrupo}
                onChange={(e) => setNombreGrupo(e.target.value)}
              />
              <Input
                placeholder="Mails separados por coma (ej: a@mail.com, b@mail.com)"
                value={mailsGrupo}
                onChange={(e) => setMailsGrupo(e.target.value)}
              />
              <Input
                placeholder="URL Foto del grupo (Opcional)"
                value={fotoGrupo}
                onChange={(e) => setFotoGrupo(e.target.value)}
              />
              <Button onClick={() => handleCrearGrupo(close)} className="w-full">
                Crear Grupo
              </Button>
            </div>
          )}
        </div>
      )}
    </Popup>
  );
}