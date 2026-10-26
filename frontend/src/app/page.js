'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './welcome.module.css';

export default function Home() {
  const router = useRouter();
  const [encendido, setEncendido] = useState(false);
  const timer = useRef(null);

  // Limpia el temporizador si se sale de la página antes de tiempo
  useEffect(() => () => clearTimeout(timer.current), []);

  const handleLogin = () => {
    router.push('/login');
  };

  // Al tocar el diner se ilumina y, un instante después, entra al login
  const handleDiner = () => {
    if (encendido) return;
    setEncendido(true);
    timer.current = setTimeout(() => router.push('/login'), 900);
  };

  const handleRegistro = () => {
    router.push('/registro');
  };

  return (
    <main className={styles.container}>
      {/* Locales vecinos a los costados del diner (decorativo) */}
      <div className={styles.locales} aria-hidden="true" />

      {/* Tinte de atardecer y viñeta (el fondo y la calle están en el CSS) */}
      <div className={styles.overlay} />

      {/* El diner es una capa aparte: al hacerle clic se ilumina y se entra al login */}
      <button
        type="button"
        onClick={handleDiner}
        className={`${styles.dinerButton} ${encendido ? styles.encendido : ''}`}
        aria-label="Entrar al diner e iniciar sesión"
        aria-busy={encendido}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/diner.png" alt="" className={styles.dinerImg} draggable={false} />
        {/* Versión con las luces prendidas: se muestra al tocar */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/diner_on.png" alt="" className={styles.dinerOn} draggable={false} />
        
      </button>

      {/* Contenedor de botones alineado en la zona inferior */}
      <div className={styles.menuBox}>
        <p className={styles.welcomeText}>¿No tienes cuenta?</p>

        <div className={styles.buttonGroup}>
          <button type="button" onClick={handleRegistro} className={styles.btnRegister}>
            REGISTRARSE
          </button>
        </div>
      </div>
    </main>
  );
}