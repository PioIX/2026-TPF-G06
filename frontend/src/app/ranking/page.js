'use client';

// Va en: app/ranking/page.js
// Uso:
//   /ranking                    -> al terminar una partida (envía tu puntaje y muestra el ranking)
//   /ranking?id_partida=5       -> solo mira el ranking guardado de esa sala (no hace falta que nadie esté online)

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import './ranking.css';

const SOCKET_URL = 'http://localhost:4000';
const API_URL = 'http://localhost:4000/api';

const INTERVALO_REFRESCO = 3000;

const leerId = (...claves) => {
  for (const almacen of [sessionStorage, localStorage]) {
    for (const k of claves) {
      const valor = almacen.getItem(k);
      if (valor !== null && valor !== '' && !Number.isNaN(Number(valor))) {
        return Number(valor);
      }
    }

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

  useEffect(() => {
    // Si viene ?id_partida=X en la URL, solo se mira el ranking de esa sala
    const params = new URLSearchParams(window.location.search);
    const idQuery = Number(params.get('id_partida'));

    const id_partida =
      idQuery || leerId('id_partida', 'idPartida', 'partidaActual');
    const id_usuario = leerId('id_usuario', 'idUsuario');

    idPartidaRef.current = id_partida;
    setIdUsuario(id_usuario);

    let resultado = null;

    try {
      resultado = JSON.parse(
        sessionStorage.getItem('resultadoPartida') || 'null'
      );
    } catch (e) {
      resultado = null;
    }

    if (!id_partida) {
      setError('No se encontró la sala.');
      setCargando(false);
      return;
    }

    // Solo se envía el puntaje si venimos de jugar (hay resultado y no se pidió otra sala)
    const debeEnviar = Boolean(resultado) && !idQuery;

    if (debeEnviar && !id_usuario) {
      setError(
        'No se encontró el usuario. Revisá cómo guardás id_usuario.'
      );
      setCargando(false);
      return;
    }

    // Modo solo lectura: se muestra lo que ya está guardado en la base de datos
    if (!debeEnviar) {
      pedirRanking(id_partida).finally(() => setCargando(false));
      return;
    }

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

  // Solo se sigue consultando si acabo de jugar y todavía falta el otro jugador
  useEffect(() => {
    if (
      cargando ||
      error ||
      completo ||
      miPuntaje === null ||
      !idPartidaRef.current
    )
      return;

    const intervalo = setInterval(
      () => pedirRanking(idPartidaRef.current),
      INTERVALO_REFRESCO
    );

    return () => clearInterval(intervalo);
  }, [cargando, error, completo, miPuntaje]);

  const medalla = (i) =>
    i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;

  return (
    <main className="ranking-page">

      <h1 className="ranking-titulo">
        🏆 Ranking
      </h1>

      {miPuntaje !== null && (
        <p className="ranking-mi-puntaje">
          Tu puntaje: <strong>{miPuntaje}</strong>
        </p>
      )}

      {cargando && (
        <p className="ranking-cargando">
          Cargando ranking...
        </p>
      )}

      {error && (
        <p className="ranking-error">
          {error}
        </p>
      )}

      {!cargando && !error && (
        <>
          <ol className="ranking-lista">
            {ranking.map((fila, i) => (
              <li
                key={fila.id_usuario}
                className={`ranking-jugador ${
                  fila.id_usuario === idUsuario ? 'jugador-actual' : ''
                }`}
              >
                <span className="ranking-nombre">
                  {medalla(i)} {fila.nombre}
                  {fila.id_usuario === idUsuario ? ' (vos)' : ''}
                </span>

                <span className="ranking-puntaje">
                  {fila.puntaje} pts
                </span>
              </li>
            ))}
          </ol>

          {ranking.length === 0 && miPuntaje === null && (
            <p className="ranking-esperando">
              Todavía nadie jugó esta sala.
            </p>
          )}

          {!completo && miPuntaje !== null && (
            <p className="ranking-esperando">
              Esperando el puntaje del otro jugador...
            </p>
          )}
        </>
      )}

      <div className="ranking-botones">
        <button
          className="ranking-boton ranking-boton-secundario"
          onClick={() => router.push('/sala')}
        >
          Volver a la sala
        </button>

        <button
          className="ranking-boton ranking-boton-secundario"
          onClick={() =>
            router.push(
              idPartidaRef.current
                ? `/partidas?id=${idPartidaRef.current}`
                : '/partidas'
            )
          }
        >
          Volver a partidas
        </button>

        <button
          className="ranking-boton"
          onClick={() => router.push('/')}
        >
          Volver al inicio
        </button>
      </div>

    </main>
  );
}