'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import './inicio.css';

export default function Inicio() {
    const router = useRouter();
    const [mostrarInstrucciones, setMostrarInstrucciones] = useState(false);

    return (
        <main className="inicio-container">
            <div className="inicio-contenido">
                <button
                    className="inicio-boton jugar-boton"
                    onClick={() => router.push('/sala')}
                >
                    Jugar
                </button>

                <button
                    className="inicio-boton instrucciones-boton"
                    onClick={() => setMostrarInstrucciones(true)}
                >
                    Instrucciones
                </button>
            </div>

            {mostrarInstrucciones && (
                <div
                    className="popup-overlay"
                    onClick={() => setMostrarInstrucciones(false)}
                >
                    <div
                        className="popup-instrucciones"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            className="popup-cerrar"
                            onClick={() => setMostrarInstrucciones(false)}
                            aria-label="Cerrar instrucciones"
                        >
                            ×
                        </button>

                        <div className="popup-contenido">
                            <p>¡Bienvenido a Food Fast Rush!</p>
                            <p>¿Estás listo para convertirte en chef?</p>
                            <ul>
                                <li>Mirá el pedido y prestá atención a los ingredientes que necesita cada cliente</li>
                                <li>Seleccioná los ingredientes y colocá cada uno en el orden correcto para armar la hamburguesa.</li>
                                <li>Completá el pedido con todos los ingredientes necesarios.</li>
                                <li>Revisá que no falte nada antes de entregar la hamburguesa.</li>
                                <li>¡Entregá la mayor cantidad de pedidos antes que tu rival y conseguí la mayor cantidad de puntos posible! ¡El que consigue más gana!</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}