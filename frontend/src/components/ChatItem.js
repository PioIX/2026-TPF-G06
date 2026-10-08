"use client";

import React from "react";

export default function ChatItem({ chat, onSelect }) {
  // Asegura la compatibilidad con las propiedades que devuelve el backend
  const foto = chat.foto || chat.foto_grupo || chat.foto_perfil || "/default-profile.png";
  const nombre = chat.nombre || chat.nom_grupo || "Chat";

  return (
    <div 
      onClick={() => onSelect && onSelect(chat)} 
      className="flex items-center gap-3 p-3 hover:bg-gray-100 cursor-pointer border-b border-gray-200 transition"
    >
      <img
        src={foto}
        alt={nombre}
        className="w-12 h-12 rounded-full object-cover border"
      />
      <div className="flex flex-col">
        <h3 className="font-semibold text-gray-800 text-sm">{nombre}</h3>
        <span className="text-xs text-gray-500">
          {chat.es_grupo ? "Grupo" : "Contacto"}
        </span>
      </div>
    </div>
  );
}