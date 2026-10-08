# Backend TP2 - Pio Socket

Backend base (Node.js + Express + Socket.IO) que se entrega a los alumnos para el **Trabajo Práctico N°2**, tal como se explica en el **Apunte 09 – Sockets**.

## Eventos

- `pingAll`: reenvía el mensaje recibido a **todos** los clientes conectados.
- `joinRoom`: une al socket a una sala (`room`), sacándolo antes de la sala anterior si tenía una.
- `sendMessage`: reenvía el mensaje a todos los clientes de la sala actual.
- `eventoPersonalizado`: incrementa un contador y responde con `respuestaPersonalizada` (el contador es por cliente, no compartido).

## Cómo iniciarlo

```bash
npm install
npm start      # producción: node index.js
npm run dev     # desarrollo: nodemon index.js
```

Corre en `http://localhost:4000` por defecto (`process.env.PORT`), con CORS habilitado para `http://localhost:3000` y `http://localhost:3001`.

## Generar el ejecutable para entregar a los alumnos

```bash
npm run build   # genera build/backend-tp2.exe (Windows, sin necesidad de Node.js)
```

Ver `2do-cuatrimestre/evaluaciones/backend/Instrucciones-ejecutable.md` para troubleshooting del empaquetado con `pkg`.
