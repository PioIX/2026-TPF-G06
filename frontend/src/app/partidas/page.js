'use client';

import { useState, useEffect } from 'react';

export interface Ingrediente {
  id: number;
  nombre: string;
  seccion: 'abajo' | 'arriba' | 'carnes' | 'quesos' | 'medio';
  tipo: string; // URL de la imagen
}

const API_URL = 'http://localhost:3000/api';

export default function JuegoHamburguesa() {
  const [todosLosIngredientes, setTodosLosIngredientes] = useState<Ingrediente[]>([]);
  const [recetaObjetivo, setRecetaObjetivo] = useState<Ingrediente[]>([]);
  const [miHamburguesa, setMiHamburguesa] = useState<Ingrediente[]>([]);
  const [filtroSeccion, setFiltroSeccion] = useState<string>('todos');
  const [cargando, setCargando] = useState<boolean>(true);

  const iniciarJuego = async () => {
    setCargando(true);
    setMiHamburguesa([]);

    try {
      // 1. Obtener la orden aleatoria a armar
      const resOrden = await fetch(`${API_URL}/orden-aleatoria`);
      const ordenData = await resOrden.json();
      setRecetaObjetivo(ordenData);

      // 2. Obtener lista completa de ingredientes (solo la primera vez)
      if (todosLosIngredientes.length === 0) {
        const resIng = await fetch(`${API_URL}/ingredientes`);
        const ingData = await resIng.json();
        setTodosLosIngredientes(ingData);
      }
    } catch (error) {
      console.error('Error al conectar con la API Express:', error);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    iniciarJuego();
  }, []);

  const agregarIngrediente = (ingrediente: Ingrediente) => {
    setMiHamburguesa((prev) => [...prev, ingrediente]);
  };

  const deshacer = () => {
    setMiHamburguesa((prev) => prev.slice(0, -1));
  };

  const verificar = () => {
    if (miHamburguesa.length !== recetaObjetivo.length) {
      alert('¡La cantidad de ingredientes no coincide!');
      return;
    }

    const esCorrecta = miHamburguesa.every(
      (ing, idx) => ing.id === recetaObjetivo[idx].id
    );

    if (esCorrecta) {
      alert('¡Excelente! Hamburguesa entregada a tiempo 🍔✨');
      iniciarJuego();
    } else {
      alert('¡Ups! Te equivocaste en el orden o en los ingredientes.');
    }
  };

  const ingredientesFiltrados =
    filtroSeccion === 'todos'
      ? todosLosIngredientes
      : todosLosIngredientes.filter((i) => i.seccion === filtroSeccion);

  if (cargando) {
    return <div className="p-8 text-center text-lg font-semibold">Cargando pedido...</div>;
  }

  return (
    <div className="flex flex-wrap justify-center gap-8 p-6 bg-gray-100 min-h-screen font-sans">
      {/* 1. Receta del Cliente */}
      <div className="w-72 bg-white p-5 rounded-xl shadow-md flex flex-col items-center">
        <h3 className="font-bold text-lg mb-4 text-gray-800">Pedido del Cliente</h3>
        <div className="flex flex-col items-center">
          {recetaObjetivo.map((ingrediente, idx) => (
            <img
              key={idx}
              src={ingrediente.tipo}
              alt={ingrediente.nombre}
              title={ingrediente.nombre}
              className="w-14 -mb-3 object-contain"
            />
          ))}
        </div>
      </div>

      {/* 2. Hamburguesa del Jugador */}
      <div className="w-72 bg-white p-5 rounded-xl shadow-md flex flex-col">
        <h3 className="font-bold text-lg mb-4 text-center text-gray-800">Tu Hamburguesa</h3>
        <div className="flex-1 flex flex-col-reverse items-center min-h-[280px] border-b-4 border-amber-800 justify-start">
          {miHamburguesa.map((ingrediente, idx) => (
            <img
              key={idx}
              src={ingrediente.tipo}
              alt={ingrediente.nombre}
              title={ingrediente.nombre}
              className="w-20 -mb-3 object-contain"
            />
          ))}
        </div>
        <div className="flex gap-2 mt-4">
          <button
            onClick={deshacer}
            className="flex-1 py-2 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition"
          >
            Deshacer
          </button>
          <button
            onClick={verificar}
            className="flex-1 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition"
          >
            Servir
          </button>
        </div>
      </div>

      {/* 3. Despensa con Filtros de Sección */}
      <div className="w-80 bg-white p-5 rounded-xl shadow-md">
        <h3 className="font-bold text-lg mb-3 text-gray-800">Ingredientes</h3>

        {/* Pestañas de Filtro */}
        <div className="flex flex-wrap gap-1 mb-4">
          {['todos', 'abajo', 'carnes', 'quesos', 'medio', 'arriba'].map((sec) => (
            <button
              key={sec}
              onClick={() => setFiltroSeccion(sec)}
              className={`px-2.5 py-1 text-xs font-medium rounded capitalize border transition ${
                filtroSeccion === sec
                  ? 'bg-amber-500 text-white border-amber-600'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-300'
              }`}
            >
              {sec}
            </button>
          ))}
        </div>

        {/* Grilla de Selección de Ingredientes */}
        <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto p-1">
          {ingredientesFiltrados.map((ing) => (
            <button
              key={ing.id}
              onClick={() => agregarIngrediente(ing)}
              className="flex flex-col items-center p-2 border-2 border-gray-200 rounded-lg hover:border-amber-500 hover:scale-105 transition bg-white"
            >
              <img src={ing.tipo} alt={ing.nombre} className="w-12 h-12 object-contain" />
              <span className="text-xs mt-1 text-gray-700 font-medium">{ing.nombre}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}