import cors from 'cors';
import express from 'express';
import cookieParser from 'cookie-parser';

const app = express();

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));


app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cookieParser());
app.use(express.static('public'));



// Routes will be added here later

import userRoutes from './routes/user.routes.js';

app.use('/users', userRoutes);

export { app };
