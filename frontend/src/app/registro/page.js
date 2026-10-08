'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';

let socket;

const FOTOS_DISPONIBLES = [
  { id: 1, url: "/foto1.jpeg", nombre: "Opción 1" },
  { id: 2, url: "/perro.jpg", nombre: "Opción 2" },
  { id: 3, url: "/conejo.jpg", nombre: "Opción 3" }
];

const FOTO_DEFAULT = { id: 0, url: "/default-profile.png", nombre: "Por defecto" };

export default function RegistroPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [mail, setMail] = useState('');
  const [password, setPassword] = useState('');
  const [fotoPerfil, setFotoPerfil] = useState(FOTO_DEFAULT);

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
      contra: password,
      fotoPerfil: fotoPerfil.url
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="bg-white p-6 rounded shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-4">Registro</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="w-full p-2 border border-gray-300 rounded text-black outline-none focus:border-blue-500"
          />
          <input
            type="email"
            placeholder="Mail"
            value={mail}
            onChange={(event) => setMail(event.target.value)}
            className="w-full p-2 border border-gray-300 rounded text-black outline-none focus:border-blue-500"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full p-2 border border-gray-300 rounded text-black outline-none focus:border-blue-500"
          />

          <h3 className="font-semibold text-sm text-gray-700">Elige tu foto de perfil (Opcional):</h3>

          <ul className="flex flex-wrap gap-2 justify-center list-none p-0">
            <li
              onClick={() => setFotoPerfil(FOTO_DEFAULT)}
              className={`p-1 border rounded cursor-pointer text-center ${
                fotoPerfil?.id === FOTO_DEFAULT.id ? 'border-blue-600 border-2' : 'border-gray-300'
              }`}
            >
              <img src={FOTO_DEFAULT.url} alt="Foto por defecto" className="w-12 h-12 object-cover rounded-full" />
              <small className="block text-[10px] mt-1">Sin foto</small>
            </li>

            {FOTOS_DISPONIBLES.map(foto => (
              <li
                key={foto.id}
                onClick={() => setFotoPerfil(foto)}
                className={`p-1 border rounded cursor-pointer text-center ${
                  fotoPerfil?.id === foto.id ? 'border-blue-600 border-2' : 'border-gray-300'
                }`}
              >
                <img src={foto.url} alt={foto.nombre} className="w-12 h-12 object-cover rounded-full" />
              </li>
            ))}
          </ul>

          <button 
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded font-semibold hover:bg-blue-700 transition"
          >
            Registrarse
          </button>
        </form>
      </div>
    </div>
  );
}