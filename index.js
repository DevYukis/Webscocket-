require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const os = require('os');

// Detecta o IP da máquina local (fallback para desenvolvimento local)
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

console.log(`IP da máquina local: ${ipAddress}`);

function isValidToken(token) {
  return token === process.env.TOKEN;
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

const port = process.env.PORT || 8080; // Usa a porta fornecida pela Railway ou 8080 como fallback

// Middleware para logar requisições HTTPS
app.use((req, res, next) => {
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  if (protocol === 'https') {
    console.log(`[HTTPS] Requisição recebida de ${req.ip} para ${req.originalUrl}`);
  }
  next();
});

// Quando alguém conecta via WebSocket
wss.on('connection', (ws, request) => {
  console.log(`[WebSocket] Cliente conectado: ${request.socket.remoteAddress}`);

  ws.on('message', (message) => {
    console.log(`[WebSocket] Mensagem recebida de cliente: ${message}`);
    // Envia a mensagem para todos os clientes conectados
    wss.clients.forEach(client => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message.toString());
      }
    });
  });

  ws.on('close', () => {
    console.log(`[WebSocket] Cliente desconectado: ${request.socket.remoteAddress}`);
  });
});

// Rota HTTP para exibir o link do WebSocket
app.get('/', (req, res) => {
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers.host;
  const wsProtocol = protocol === 'https' ? 'wss' : 'ws';
  const wsUrl = `${wsProtocol}://${host}`;

  console.log(`[HTTP] Página inicial acessada por ${req.ip}`);

  res.send(`
    <html>
      <body>
        <h1>WebSocket Railway</h1>
        <p>Conectando ao WebSocket em: <code>${wsUrl}</code></p>
        <script>
          const socket = new WebSocket("${wsUrl}");
          socket.onopen = () => socket.send("Olá do cliente!");
          socket.onmessage = (event) => console.log("Recebido:", event.data);
        </script>
      </body>
    </html>
  `);
});

// Lida com a autenticação e upgrade para WebSocket
server.on('upgrade', (request, socket, head) => {
  const authHeader = request.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log(`[WebSocket] Conexão rejeitada: Token ausente ou inválido`);
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  const token = authHeader.split(' ')[1];
  if (!isValidToken(token)) {
    console.log(`[WebSocket] Conexão rejeitada: Token inválido`);
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
    return;
  }

  console.log(`[WebSocket] Conexão autenticada de ${request.socket.remoteAddress}`);
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

// Inicia o servidor
server.listen(port, '0.0.0.0', () => {
  const publicUrl = process.env.RAILWAY_STATIC_URL || `http://${ipAddress}:${port}`; // Usa o domínio público da Railway ou o IP local
  console.log(`Servidor WebSocket rodando em: ${publicUrl}`);
});

// Permite enviar mensagens do terminal para os clientes conectados
process.stdin.on('data', (data) => {
  const message = data.toString().trim();
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(`${message}`);
    }
  });
  console.log(`[Servidor] Mensagem enviada do terminal: ${message}`);
});
