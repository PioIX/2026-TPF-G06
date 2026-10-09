'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from "@/components/Button";
import './login.css'; // <-- Importa el archivo CSS aquí

export default function LoginPage() {
  const [mail, setMail] = useState('');
  const [contra, setContra] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

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

      if (res.ok && data.respuesta?.ok) {
        if (data.existe && data.existe.length > 0) {
          localStorage.setItem('usuario', JSON.stringify(data.existe[0]));
        }
        router.push('/partidas');
      } else {
        setError(data.respuesta?.msg || data.message || 'Credenciales incorrectas');
      }
    } catch (err) {
      console.error(err);
      setError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">Iniciar Sesión</h1>

        <form onSubmit={handleSubmit} className="login-form">
          <input 
            type="email" 
            placeholder="Mail" 
            value={mail}
            onChange={(e) => setMail(e.target.value)}
            required
            className="login-input"
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={contra}
            onChange={(e) => setContra(e.target.value)}
            required
            className="login-input"
          />
          
          {error && <p className="login-error">{error}</p>}

          <Button type="submit" disabled={loading} className="login-button">
            {loading ? 'Cargando...' : 'Iniciar sesión'}
          </Button>
        </form>
      </div>
    </div>
  );
}