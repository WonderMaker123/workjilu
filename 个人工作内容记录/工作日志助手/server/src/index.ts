import 'dotenv/config';
import { createApp } from './app';

const PORT = Number(process.env.PORT) || 3001;
const app = createApp();

app.listen(PORT, () => {
  console.log(`WorkLog server running at http://localhost:${PORT}`);
});
