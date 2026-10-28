"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const API = "http://localhost:4000";
const medals = ["🥇", "🥈"];

export default function RankingPage() {
  const { roomId } = useParams();
  const router = useRouter();
  const [ranking, setRanking] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let activo = true;
    let intervalo;

    const cargar = async () => {
      try {
        const r = await fetch(`${API}/api/ranking/${roomId}`);
        if (!r.ok) throw new Error();
        const data = await r.json();
        if (!activo) return;

        setRanking(
          data.ranking.map((p, i) => ({
            position: i + 1,
            name: p.nombre,
            score: p.puntaje,
          }))
        );

        // Cuando ya están los dos jugadores, dejamos de consultar
        if (data.ranking.length >= 2) clearInterval(intervalo);
      } catch {
        if (activo) setError("No se encontró el ranking de esta sala.");
      }
    };

    cargar();
    intervalo = setInterval(cargar, 2000);

    return () => {
      activo = false;
      clearInterval(intervalo);
    };
  }, [roomId]);

  if (error) return <p style={{ padding: 24 }}>{error}</p>;
  if (!ranking) return <p style={{ padding: 24 }}>Cargando ranking...</p>;

  return (
    <main style={{ maxWidth: 480, margin: "40px auto", padding: 16 }}>
      <h1>🍔 Ranking de la sala</h1>

      {ranking.length < 2 && <p>Esperando que termine el otro jugador…</p>}

      <ol style={{ listStyle: "none", padding: 0 }}>
        {ranking.map((p) => (
          <li
            key={p.position}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: 16,
              marginBottom: 12,
              borderRadius: 12,
              border: "1px solid #ddd",
              fontSize: 20,
            }}
          >
            <span>
              {ranking.length >= 2 ? medals[p.position - 1] : ""} {p.name}
            </span>
            <strong>{p.score} pts</strong>
          </li>
        ))}
      </ol>

      <button onClick={() => router.push("/")}>Volver al inicio</button>
    </main>
  );
}