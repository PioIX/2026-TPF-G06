'use client';

import { useRouter } from 'next/navigation';
import styles from './welcome.module.css';

export default function Home() {
  const router = useRouter();

  const handleLogin = () => {
    router.push('/login');
  };

  const handleRegistro = () => {
    router.push('/registro');
  };

  return (
    <main className={styles.container}>
      {/* Capa de oscurecimiento suave para resaltar la interfaz */}
      <div className={styles.overlay} />

      {/* Contenedor de botones alineado en la zona inferior */}
      <div className={styles.menuBox}>
        <p className={styles.welcomeText}>¡BIENVENIDO A LA COCINA!</p>

        <div className={styles.buttonGroup}>
          <button 
            type="button" 
            onClick={handleLogin} 
            className={styles.btnLogin}
          >
            INICIAR SESIÓN
          </button>
          <button 
            type="button" 
            onClick={handleRegistro} 
            className={styles.btnRegister}
          >
            REGISTRARSE
          </button>
        </div>
      </div>
    </main>
  );
}