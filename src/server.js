import dotenv from 'dotenv';
// If .env is in the 'backend' folder (one level up from src), use this:
dotenv.config({ path: './.env' });

import connectDB from './db/db.js'; // Ensure this file exists at src/db/db.js
import { app } from './app.js'; // Ensure this file exists at src/app.js

const PORT = process.env.PORT || 8000;


connectDB().then(() => {
    app.get('/', (req, res) => {
        res.send('Hello, World!');
    })

    app.on('error', (error) => {
        console.error("Error in Express app:", error);
        throw error;
    });


    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    })
}).catch((error) => {
    console.error("Failed to connect to MongoDB:", error);
    process.exit(1);
});

