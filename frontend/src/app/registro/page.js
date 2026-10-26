'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { io } from 'socket.io-client';
import './registro.css';

let socket;

export default function RegistroPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [mail, setMail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    socket = io("http://localhost:4000");

    socket.on("connect", () => {
      console.log("Conectado al servidor Socket.IO con ID:", socket.id);
    });

    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  function handleSubmit(event) {
    event.preventDefault();

    if (!username || !mail || !password) {
      alert("Por favor completa todos los campos.");
      return;
    }

    if (!socket || !socket.connected) {
      alert("No hay conexión con el servidor.");
      return;
    }

    socket.emit("register", {
      nombre: username,
      mail: mail,
      contra: password
    }, (respuesta) => {
      if (respuesta && respuesta.ok) {
        alert("Registro exitoso");
        router.push('/login');
      } else {
        alert("Error al registrar: " + (respuesta?.msg || "Sin respuesta del servidor"));
      }
    });
  }

  return (
    <div className="registro-container">
      <div className="registro-card">
        <div className="registro-steel" />

        <form onSubmit={handleSubmit} className="registro-form">
          <h1 className="registro-form-title">REGISTRO</h1>

          <input
            type="text"
            placeholder="Usuario"
            aria-label="Usuario"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
            className="registro-input"
          />

          <input
            type="email"
            placeholder="Correo"
            aria-label="Correo"
            autoComplete="email"
            value={mail}
            onChange={(event) => setMail(event.target.value)}
            required
            className="registro-input"
          />

          <input
            type="password"
            placeholder="Contraseña"
            aria-label="Contraseña"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className="registro-input"
          />

          <button type="submit" className="registro-button">
            Registrarse
          </button>

          <p className="registro-alt">
            ¿Ya tenés cuenta? <Link href="/login">Entrá</Link>
          </p>
        </form>
      </div>
    </div>
  );
}