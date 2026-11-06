import { app } from './app.js';
import { connectDb } from './db.js';
import { startMaintenance } from './maintenance.js';

const port = process.env.PORT || 4000;
connectDb()
  .then(() => {
    startMaintenance();
    app.listen(port, () => console.log(`API escuchando en el puerto ${port}`));
  })
  .catch((err) => {
    console.error('No se pudo iniciar la API:', err.message);
    process.exit(1);
  });
