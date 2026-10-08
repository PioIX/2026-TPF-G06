"use client";

import React from "react";

export default function Message({ mensaje, esPropio }) {
  return (
    <div className={`flex flex-col my-1 max-w-[70%] ${esPropio ? "ml-auto items-end" : "mr-auto items-start"}`}>
      <div
        className={`p-3 rounded-lg text-sm shadow-sm ${
          esPropio
            ? "bg-blue-600 text-white rounded-br-none"
            : "bg-gray-200 text-gray-800 rounded-bl-none"
        }`}
      >
        {!esPropio && (
          <span className="block text-xs font-bold text-gray-600 mb-1">
            {mensaje.username || mensaje.nombre}
          </span>
        )}
        <p>{mensaje.texto || mensaje.contenido}</p>
      </div>
      <span className="text-[10px] text-gray-400 mt-0.5 px-1">
        {mensaje.fecha_hora ? new Date(mensaje.fecha_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
      </span>
    </div>
  );
}