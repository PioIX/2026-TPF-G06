'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from "@/components/Button";

export default function LoginPage() {
  const [mail, setMail] = useState('');
  const [contra, setContra] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    try {
      const res = await fetch('http://localhost:4000/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mail, contra }),
      });

      const data = await res.json();
      console.log("Respuesta de Login:", data);

      // Corregido: la API devuelve { ok: true, usuario: {...} }
      if (res.ok && data.ok) {
        // Guardamos la información del usuario logueado en localStorage
        localStorage.setItem('usuario', JSON.stringify(data.usuario));

        // Redirigimos a la pantalla principal del chat
        router.push('/partidas');
      } else {
        setError(data.msg || 'Credenciales incorrectas');
      }
    } catch (error) {
      console.error(error);
      setError('Error al conectar con el servidor');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="bg-white p-6 rounded shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-4">Iniciar Sesión</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input 
            type="email" 
            placeholder="Mail" 
            value={mail}
            onChange={(e) => setMail(e.target.value)}
            required
            className="w-full p-2 border border-gray-300 rounded text-black outline-none focus:border-blue-500"
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={contra}
            onChange={(e) => setContra(e.target.value)}
            required
            className="w-full p-2 border border-gray-300 rounded text-black outline-none focus:border-blue-500"
          />
          
          {error && <p className="text-red-500 text-xs text-center">{error}</p>}

          <Button type="submit" className="w-full">Iniciar sesión</Button>
        </form>
      </div>
    </div>
  );
}