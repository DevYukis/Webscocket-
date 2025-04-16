require('dotenv').config();
const WebSocket = require('ws');
const http = require('http');

function isValidToken(token) {
  return token === process.env.TOKEN;
}

const port = process.env.PORT || 3000; // Porta fornecida pela Railway ou fallback para 3000
const server = http.createServer();
const wss = new WebSocket.Server({ noServer: true });

wss.on('connection', (ws, request) => {
  ws.on('message', (message) => {
    console.log(`Mensagem recebida de cliente: ${message}`);
    wss.clients.forEach(client => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message.toString());
      }
    });
  });
});

server.on('upgrade', (request, socket, head) => {
  const authHeader = request.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  const token = authHeader.split(' ')[1];
  if (!isValidToken(token)) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

server.listen(port, () => {
  console.log(`App listening on port: ${port}`);
});

process.stdin.on('data', (data) => {
  const message = data.toString().trim();
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(`${message}`);
    }
  });
  console.log(`Mensagem enviada do servidor: ${message}`);
});