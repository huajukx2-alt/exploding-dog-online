import { createServer } from 'node:http';
import { attachRoomServer } from './rooms.mjs';

const server = createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' }).end('ok');
    return;
  }
  response.writeHead(404).end();
});
attachRoomServer(server);
server.listen(Number(process.env.PORT || 4173), process.env.HOST || '0.0.0.0', () => {
  console.log(`Room server listening on port ${server.address().port}`);
});
