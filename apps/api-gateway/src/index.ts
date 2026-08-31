import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'API Gateway is running' });
});

// Aquí irán las rutas que redirigen el tráfico a los microservicios
// usando el broker de mensajería asíncrona o proxies según la necesidad final
// (Nota: la rúbrica pide 100% comunicación asíncrona entre servicios, 
// así que el Gateway publicará eventos/comandos al broker).

app.listen(PORT, () => {
  console.log(`🚀 API Gateway corriendo en http://localhost:${PORT}`);
});
