require('dotenv').config();
const WebSocket = require('ws');
const http = require('http');

// Função para validar o token
function isValidToken(token) {
  return token === process.env.TOKEN;
}

// Usa a porta do Railway se estiver disponível
const port = process.env.PORT || 8080;
const server = http.createServer();
const wss = new WebSocket.Server({ noServer: true });

// Evento de conexão WebSocket
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

// Upgrade de conexão HTTP para WebSocket com autenticação via token Bearer
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

// Inicia o servidor e imprime o link de acesso
server.listen(port, () => {
  const domain = process.env.RAILWAY_STATIC_URL || 'localhost';
  const protocol = domain === 'localhost' ? 'ws' : 'wss';
  const link = `${protocol}://${domain}${domain === 'localhost' ? `:${port}` : ''}`;
  console.log(`Servidor WebSocket rodando na porta ${port}`);
  console.log(`Link de acesso externo: ${link}`);
});

// Permite enviar mensagens do terminal para todos os clientes conectados
process.stdin.on('data', (data) => {
  const message = data.toString().trim();
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(`${message}`);
    }
  });
  console.log(`Mensagem enviada do servidor: ${message}`);
});