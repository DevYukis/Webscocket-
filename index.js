require('dotenv').config();
const WebSocket = require('ws');
const http = require('http');
const os = require('os');

// Detecta o IP da máquina
const interfaces = os.networkInterfaces();
let ipAddress = '127.0.0.1'; // fallback

for (const name of Object.keys(interfaces)) {
  for (const iface of interfaces[name]) {
    if (iface.family === 'IPv4' && !iface.internal) {
      ipAddress = iface.address;
      break;
    }
  }
}

console.log(`IP da máquina: ${ipAddress}`);

function isValidToken(token) {
  return token === process.env.TOKEN;
}

const port = process.env.PORT || 8080; // Usa a porta fornecida pela Railway ou 8080 como fallback
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

server.listen(port, '0.0.0.0', () => {
  const host = process.env.HOST || ipAddress; // Usa o IP detectado ou o domínio configurado
  const url = process.env.RAILWAY_STATIC_URL || `http://${host}:${port}`; // Detecta o domínio público da Railway
  console.log(`Servidor WebSocket rodando em: ${url}`);
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
