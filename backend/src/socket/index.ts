import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { env } from '../config/env';
import { setRealtimePublisher } from '../realtime/publisher';

export function attachSocket(server: HttpServer) {
  const io = new Server(server, {
    cors: {
      origin: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
    },
  });

  setRealtimePublisher((event, payload) => {
    io.emit(event, payload);
  });

  io.on('connection', (socket) => {
    socket.emit('connected', { id: socket.id });
  });

  return io;
}
