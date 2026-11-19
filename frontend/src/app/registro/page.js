'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { io } from 'socket.io-client';
import './registro.css';
//import { BACKEND_URL } from '../../ip/page';
import Input from '../../components/Input';
import Button from '../../components/Button';

let socket;

export default function RegistroPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [mail, setMail] = useState('');
  const [password, setPassword] = useState('');

  // Estado para controlar el popup
  const [popup, setPopup] = useState({
    isOpen: false,
    message: '',
    type: 'info', // 'success' o 'error'
    onConfirm: null
  });

  const showPopup = (message, type = 'error', onConfirm = null) => {
    setPopup({ isOpen: true, message, type, onConfirm });
  };

  const closePopup = () => {
    const action = popup.onConfirm;
    setPopup({ isOpen: false, message: '', type: 'info', onConfirm: null });
    if (action) action();
  };

  useEffect(() => {
    socket = io('http://localhost:4000');

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
      showPopup("Por favor completa todos los campos.", "error");
      return;
    }

    if (!socket || !socket.connected) {
      showPopup("No hay conexión con el servidor.", "error");
      return;
    }

    socket.emit("register", {
      nombre: username,
      mail: mail,
      contra: password
    }, (respuesta) => {
      if (respuesta && respuesta.ok) {
        showPopup("Registro exitoso", "success", () => {
          router.push('/login');
        });
      } else {
        showPopup("Error al registrar: " + (respuesta?.msg || "Sin respuesta del servidor"), "error");
      }
    });
  }

  return (
    <div className="registro-container">
      <div className="registro-card">
        <div className="registro-steel" />

        <form onSubmit={handleSubmit} className="registro-form">
          <h1 className="registro-form-title">REGISTRO</h1>

          <Input
            type="text"
            placeholder="Usuario"
            ariaLabel="Usuario"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
            className="registro-input"
          />

          <Input
            type="email"
            placeholder="Correo"
            ariaLabel="Correo"
            autoComplete="email"
            value={mail}
            onChange={(event) => setMail(event.target.value)}
            required
            className="registro-input"
          />

          <Input
            type="password"
            placeholder="Contraseña"
            ariaLabel="Contraseña"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className="registro-input"
          />

          <Button type="submit" className="registro-button" text="Registrarse" />

          <p className="registro-alt">
            ¿Ya tenés cuenta? <Link href="/login">Entrá</Link>
          </p>
        </form>
      </div>

      {/* Popup / Modal Personalizado */}
      {popup.isOpen && (
        <div className="popup-overlay">
          <div className="popup-card">
            <div className={`popup-indicator ${popup.type}`} />
            <div className="popup-content">
              <h3 className="popup-title">
                {popup.type === 'success' ? '¡Registro Exitoso!' : 'Atención'}
              </h3>
              <p className="popup-message">{popup.message}</p>
              <Button onClick={closePopup} className="popup-button" text="Aceptar" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}