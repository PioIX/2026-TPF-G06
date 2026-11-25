'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import './ranking.css';

const SOCKET_URL = 'http://192.168.1.8:4000';
const API_URL = 'http://192.168.1.8:4000/api';

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

// "1 hamburguesa" / "2 hamburguesas"
const textoHamburguesas = (n) =>
  `${n} ${n === 1 ? 'hamburguesa' : 'hamburguesas'}`;

export default function Ranking() {
  const router = useRouter();

  const [ranking, setRanking] = useState([]);
  const [completo, setCompleto] = useState(false);
  // Puntaje total de mi partida: puntos de los pedidos + puntos por los segundos que sobraron
  const [miPuntaje, setMiPuntaje] = useState(null);
  // Detalle de mi partida: { puntosPedidos, hamburguesas, segundosSobrantes, bonusTiempo }
  const [miResultado, setMiResultado] = useState(null);
  const [idUsuario, setIdUsuario] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  // Mejor jugador del mes (todas las partidas)
  const [empleado, setEmpleado] = useState(null);
  const idPartidaRef = useRef(null);

  const pedirEmpleado = async () => {
    try {
      const res = await fetch(`${API_URL}/empleado-del-mes`);
      const data = await res.json();
      if (data.ok) setEmpleado(data.empleado);
    } catch (e) {
      console.error('Error al pedir el empleado del mes:', e);
    }
  };

  const pedirRanking = async (id_partida) => {
    try {
      const res = await fetch(`${API_URL}/ranking/${id_partida}`);
      const data = await res.json();

      if (data.ok) {
        setRanking(data.ranking);
        setCompleto(data.ranking.length >= 2);
        pedirEmpleado();
      }
    } catch (e) {
      console.error('Error al pedir el ranking:', e);
    }
  };

  useEffect(() => {
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

    const debeEnviar = Boolean(resultado) && !idQuery;

    if (debeEnviar && !id_usuario) {
      setError(
        'No se encontró el usuario. Revisá cómo guardás id_usuario.'
      );
      setCargando(false);
      return;
    }

    if (!debeEnviar) {
      pedirRanking(id_partida).finally(() => setCargando(false));
      return;
    }

    // Lo que mandó la página de partidas
    const puntosPedidos = Number(resultado.puntaje) || 0;
    const hamburguesas = Number(resultado.hamburguesas) || 0;
    const segundosSobrantes = Number(resultado.segundosSobrantes) || 0;
    const bonusTiempo = Number(resultado.bonusTiempo) || 0;

    // Al puntaje de los pedidos se le suman los segundos que sobraron
    const puntajeTotal = puntosPedidos + bonusTiempo;

    setMiPuntaje(puntajeTotal);
    setMiResultado({ puntosPedidos, hamburguesas, segundosSobrantes, bonusTiempo });

    const socket = io(SOCKET_URL, { withCredentials: false });

    socket.on('connect', () => {
      // Llamado al back: guarda el puntaje total y cuántas hamburguesas hizo
      socket.emit(
        'enviar_puntaje',
        { id_partida, id_usuario, puntaje: puntajeTotal, hamburguesas },
        (resp) => {
          if (resp?.ok) {
            sessionStorage.removeItem('resultadoPartida');
            setRanking(resp.ranking);
            setCompleto(resp.ranking.length >= 2);
            pedirEmpleado();
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

  const soyEmpleado = Boolean(empleado) && empleado.id_usuario === idUsuario;

  // Mi fila del ranking: trae el puntaje y las hamburguesas ACUMULADOS
  const miFila = ranking.find((f) => f.id_usuario === idUsuario);

  return (
    <main className="ranking-page">
      <h1 className="ranking-titulo">
        🏆 Ranking
      </h1>

      {/* EMPLEADO DEL MES: la imagen de fondo ya trae el título */}
      {empleado && (
        <>
          <div className="empleado-mes" role="img" aria-label="Empleado del mes">
            <div className="empleado-mes-contenido">
              <p className="empleado-mes-nombre">
                <span aria-hidden="true">👑</span> {empleado.nombre}
                {soyEmpleado ? ' (vos)' : ''}
              </p>

              <div className="empleado-mes-datos">
                <span className="empleado-mes-dato">
                  ⭐ {empleado.puntaje} pts
                </span>
                <span className="empleado-mes-dato mostaza">
                  🍔 {textoHamburguesas(empleado.hamburguesas ?? 0)}
                </span>
              </div>
            </div>
          </div>

          {miPuntaje !== null && (
            <p className={`empleado-mes-mensaje ${soyEmpleado ? 'logrado' : ''}`}>
              {soyEmpleado
                ? '🎉 ¡Sos el empleado del mes!'
                : `Te faltan ${Math.max(1, empleado.puntaje - (miFila?.puntaje ?? miPuntaje) + 1)} pts para ser el empleado del mes`}
            </p>
          )}
        </>
      )}

      {/* MI PUNTAJE (ticket) */}
      {miPuntaje !== null && (
        <div className="ranking-ticket">
          <p className="ranking-mi-puntaje">
            Tu puntaje: <strong>{miPuntaje}</strong>
          </p>

          {miFila && (
            <p className="ranking-mi-puntaje">
              Total acumulado: <strong>{miFila.puntaje}</strong> pts ·{' '}
              🍔 {textoHamburguesas(miFila.hamburguesas ?? 0)}
            </p>
          )}

          {miResultado && (
            <p className="ranking-mi-puntaje">
              Tiempo sobrante:{' '}
              <strong>
                {miResultado.bonusTiempo > 0
                  ? `+${miResultado.bonusTiempo} pts (${miResultado.segundosSobrantes} s)`
                  : 'sin bonus'}
              </strong>
            </p>
          )}
        </div>
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
          <h2 className="ranking-subtitulo">Posiciones de la sala</h2>

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
                  <small className="ranking-hamburguesas">
                    🍔 {textoHamburguesas(fila.hamburguesas ?? 0)}
                  </small>
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
          className="ranking-boton"
          onClick={() => router.push('/')}
        >
          Volver al inicio
        </button>
      </div>

    </main>
  );
}