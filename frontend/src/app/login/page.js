'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import './login.css';
//import { BACKEND_URL } from '../../ip/page';
import Input from '../../components/Input';
import Button from '../../components/Button';

export default function LoginPage() {
  const [mail, setMail] = useState('');
  const [contra, setContra] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
        router.push('/jugar');
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
        <form onSubmit={handleSubmit} className="login-form">
          <h1 className="login-form-title">INICIAR SESIÓN</h1>

          <Input
            type="email"
            placeholder="Correo"
            ariaLabel="Correo"
            autoComplete="email"
            value={mail}
            onChange={(e) => setMail(e.target.value)}
            required
            className="login-input"
          />

          <div className="login-password">
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="Contraseña"
              ariaLabel="Contraseña"
              autoComplete="current-password"
              value={contra}
              onChange={(e) => setContra(e.target.value)}
              required
              className="login-input"
            />
            <Button
              type="button"
              className="login-toggle"
              onClick={() => setShowPassword((v) => !v)}
              text={showPassword ? 'Ocultar' : 'Ver'}
            />
          </div>

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="login-button"
            text={loading ? 'Entrando…' : 'Entrar'}
          />

          <p className="login-alt">
            ¿Primera vez? <Link href="/registro">Registrate</Link>
          </p>
        </form>
      </div>
    </div>
  );
}