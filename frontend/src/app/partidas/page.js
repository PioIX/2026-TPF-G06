import Image from 'next/image';

// Simulamos los datos que vendrían de tu consulta SQL
const ingredientesDeLaBD = [
  {
    id_partida: 1,
    nombre: 'aceitunas negras',
    seccion: 'intermedio',
    tipo: '/public/aceitunasn.png' // La ruta que guardaste en MySQL
  }
];

export default function PaginaIngredientes() {
  return (
    <main style={{ padding: '40px', fontFamily: 'system-ui, sans-serif', backgroundColor: '#f9f9f9', minHeight: '100vh' }}>
      <h1 style={{ textAlign: 'center', color: '#333', marginBottom: '30px' }}>
        🍕 Panel de Ingredientes
      </h1>
      
      {/* Contenedor en cuadrícula (Grid) */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', 
        gap: '20px', 
        maxWidth: '1000px', 
        margin: '0 auto' 
      }}>
        
        {ingredientesDeLaBD.map((ing) => {
          // TRUCO CLAVE: Quitamos '/public' de la ruta del SQL para que Next.js la lea desde la carpeta public automáticamente
          const rutaFoto = ing.tipo.replace('/public', '');

          return (
            <div key={ing.id_partida} style={{ 
              backgroundColor: '#fff', 
              borderRadius: '12px', 
              padding: '20px', 
              boxShadow: '0 4px 6px rgba(0,0,0,0.05)', 
              textAlign: 'center',
              border: '1px solid #eaeaea'
            }}>
              
              {/* Contenedor fijo para la imagen */}
              <div style={{ width: '100%', height: '120px', position: 'relative', marginBottom: '15px' }}>
                <Image 
                  src={rutaFoto} // Quedará como '/aceitunasn.png'
                  alt={ing.nombre}
                  fill
                  style={{ objectFit: 'contain' }}
                  priority
                />
              </div>
              
              {/* Información del Ingrediente */}
              <h3 style={{ textTransform: 'capitalize', margin: '0 0 8px 0', color: '#222' }}>
                {ing.nombre}
              </h3>
              
              <span style={{ 
                backgroundColor: '#e0f2fe', 
                color: '#0369a1', 
                padding: '4px 10px', 
                borderRadius: '20px', 
                fontSize: '12px', 
                fontWeight: 'bold',
                display: 'inline-block'
              }}>
                {ing.seccion}
              </span>
              
              <div style={{ marginTop: '15px', color: '#999', fontSize: '11px' }}>
                ID Partida: {ing.id_partida}
              </div>

            </div>
          );
        })}
      </div>
    </main>
  );
}
