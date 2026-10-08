'use client'

import {useSocket} from "@/hooks/useSocket";
import { useEffect, useState } from "react";

export default function SocketPage() {
    const { socket, isConnected } = useSocket();

    // a. Estado para acumular los mensajes
    const [mensajes, setMensajes] = useState([]);

    useEffect(() => {
        if (!socket) return;

        console.log("Web Socket Conectado");

        // c. Escuchar el evento pingAll
        socket.on("pingAll", (data) => {
            setMensajes((mensajesActuales) => [
                ...mensajesActuales,
                data
            ]);
        });

        // Limpiar el listener cuando se desmonte el componente
        return () => {
            socket.off("pingAll");
        };
    }, [socket]);

    // b. Enviar mensaje a todos
    const enviarPing = () => {
        socket.emit("pingAll", {
            msg: "Hola desde mi compu"
        });
    };

    return (
        <div>
            <p>
                {isConnected
                    ? "🟢 Conectado al servidor"
                    : "🔴 Desconectado"}
            </p>

            <button onClick={enviarPing}>
                Enviar ping a todos
            </button>

            <h2>Mensajes recibidos:</h2>

            {/* d. Recorrer el array con map() */}
            <ul>
                {mensajes.map((mensaje, index) => (
                    <li key={index}>
                        {mensaje.msg}
                    </li>
                ))}
            </ul>
        </div>
    );
}