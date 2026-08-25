import { createGatewayServer } from './app.js';

const { server } = createGatewayServer();
const port = Number(process.env.PORT) || 8080;
server.listen(port, '0.0.0.0', () => console.log(`AI gateway listening on ${port}`));
