'use client';

// Va en: app/ranking/page.js

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:4000';
const API_URL = 'http://localhost:4000/api';

// Cada cuántos ms se vuelve a pedir el ranking mientras falta algún jugador
const INTERVALO_REFRESCO = 3000;

// Busca un número guardado (id_partida / id_usuario) en sessionStorage o localStorage.
// AJUSTÁ las claves si en tu proyecto guardás esos datos con otros nombres.
const leerId = (...claves) => {
  for (const almacen of [sessionStorage, localStorage]) {
    for (const k of claves) {
      const valor = almacen.getItem(k);
      if (valor !== null && valor !== '' && !Number.isNaN(Number(valor))) {
        return Number(valor);
      }
    }
    // También prueba con un objeto "usuario" guardado como JSON
    try {
      const obj = JSON.parse(almacen.getItem('usuario') || 'null');
      if (obj) {
        for (const k of claves) {
          if (obj[k] !== undefined) return Number(obj[k]);
        }
      }
    } catch (e) {
      /* se ignora */
    }
  }
  return null;
};

export default function Ranking() {
  const router = useRouter();

  const [ranking, setRanking] = useState([]);
  const [completo, setCompleto] = useState(false);
  const [miPuntaje, setMiPuntaje] = useState(null);
  const [idUsuario, setIdUsuario] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  const enviadoRef = useRef(false);
  const idPartidaRef = useRef(null);

  const pedirRanking = async (id_partida) => {
    try {
      const res = await fetch(`${API_URL}/ranking/${id_partida}`);
      const data = await res.json();
      if (data.ok) {
        setRanking(data.ranking);
        setCompleto(data.ranking.length >= 2);
      }
    } catch (e) {
      console.error('Error al pedir el ranking:', e);
    }
  };

  // Al entrar: envía el puntaje (una sola vez) y carga el ranking
  useEffect(() => {
    const id_partida = leerId('id_partida', 'idPartida', 'partidaActual');
    const id_usuario = leerId('id_usuario', 'idUsuario');
    idPartidaRef.current = id_partida;
    setIdUsuario(id_usuario);

    let resultado = null;
    try {
      resultado = JSON.parse(sessionStorage.getItem('resultadoPartida') || 'null');
    } catch (e) {
      resultado = null;
    }

    if (!id_partida || !id_usuario) {
      setError(
        'No se encontró la partida o el usuario. Revisá cómo guardás id_partida e id_usuario.'
      );
      setCargando(false);
      return;
    }

    // Si no hay resultado (por ejemplo, se refrescó la página) solo se muestra el ranking
    if (!resultado || enviadoRef.current) {
      pedirRanking(id_partida).finally(() => setCargando(false));
      return;
    }

    enviadoRef.current = true;
    setMiPuntaje(resultado.puntaje);

    const socket = io(SOCKET_URL, { withCredentials: true });

    socket.on('connect', () => {
      socket.emit(
        'enviar_puntaje',
        { id_partida, id_usuario, puntaje: resultado.puntaje },
        (resp) => {
          if (resp?.ok) {
            sessionStorage.removeItem('resultadoPartida');
            setRanking(resp.ranking);
            setCompleto(resp.ranking.length >= 2);
          } else {
            setError(resp?.msg || 'No se pudo guardar tu puntaje.');
          }
          setCargando(false);
          socket.disconnect();
        }
      );
    });

    socket.on('connect_error', () => {
      setError('No se pudo conectar con el servidor.');
      setCargando(false);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Mientras falte el otro jugador, se vuelve a pedir el ranking cada tanto
  useEffect(() => {
    if (cargando || error || completo || !idPartidaRef.current) return;
    const intervalo = setInterval(
      () => pedirRanking(idPartidaRef.current),
      INTERVALO_REFRESCO
    );
    return () => clearInterval(intervalo);
  }, [cargando, error, completo]);

  const medalla = (i) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        padding: '24px',
        background: '#fffbeb',
        fontFamily: 'sans-serif',
      }}
    >
      <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#78350f' }}>
        🏆 Ranking
      </h1>

      {miPuntaje !== null && (
        <p style={{ color: '#78350f' }}>
          Tu puntaje: <strong>{miPuntaje}</strong>
        </p>
      )}

      {cargando && <p>Cargando ranking...</p>}

      {error && <p style={{ color: '#b91c1c', textAlign: 'center' }}>{error}</p>}

      {!cargando && !error && (
        <>
          <ol
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              width: 'min(420px, 100%)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {ranking.map((fila, i) => (
              <li
                key={fila.id_usuario}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  background: fila.id_usuario === idUsuario ? '#fde68a' : 'white',
                  border: '2px solid #f59e0b',
                  fontWeight: fila.id_usuario === idUsuario ? 800 : 500,
                }}
              >
                <span>
                  {medalla(i)} {fila.nombre}
                  {fila.id_usuario === idUsuario ? ' (vos)' : ''}
                </span>
                <span>{fila.puntaje} pts</span>
              </li>
            ))}
          </ol>

          {!completo && (
            <p style={{ color: '#92400e' }}>
              Esperando el puntaje del otro jugador...
            </p>
          )}
        </>
      )}

      <button
        onClick={() => router.push('/')}
        style={{
          marginTop: '8px',
          padding: '12px 24px',
          borderRadius: '12px',
          background: '#92400e',
          color: 'white',
          fontWeight: 700,
          border: 'none',
          cursor: 'pointer',
        }}
      >
        Volver al inicio
      </button>
    </main>
  );
}