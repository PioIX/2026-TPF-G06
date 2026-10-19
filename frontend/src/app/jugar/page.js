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
                            {/* Escribí tus instrucciones acá */}
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}