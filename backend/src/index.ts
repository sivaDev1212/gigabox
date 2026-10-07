import { createServer } from 'node:http';
import { env } from './config/env';
import { createApp } from './app';
import { attachSocket } from './socket';
import { registerAutoCancel } from './jobs/autoCancel';

const app = createApp();
const server = createServer(app);
attachSocket(server);
registerAutoCancel();

server.listen(env.PORT, '0.0.0.0', () => {
  console.log(`Gigabox Ops Lite API listening on port ${env.PORT}`);
});
