const serverless = require("serverless-http");
const express = require("express");
const http = require('http');
const socketIo = require('socket.io');
const cookieParser = require('cookie-parser');
const authRoutes = require("./routes/auth.routes");
const fileRoutes = require("./routes/file.routes");
const folderRoutes = require("./routes/folder.routes");
const contactRoutes = require("./routes/contact.routes");
const sharedFileRoutes = require("./routes/shared_file.routes");
const conversationRoutes = require("./routes/conversation.routes");
const cors = require("cors");
const bodyParser = require('body-parser');
const { handleConnection, handleDisconnect } = require('./websocket');


const corsOptions = {
  origin: ["https://voist.netlify.app", "http://localhost:5173", "https://voist.me"],
  credentials: true,
};

const app = express();
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: '100mb' }));
app.use(bodyParser.raw({ type: 'audio/wav', limit: '100mb' }));
app.use(express.urlencoded({ extended: false }));

// Integración de websockets
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: corsOptions.origin,
    methods: ["GET", "POST"],
    credentials: true
  }
});

io.on('connection', (socket) => {
  console.log('Nuevo usuario conectado');
  
  // Aquí puedes agregar lógica para manejar eventos de socket
  // Ejemplo: socket.on('evento', (data) => { /* lógica */ });
});

app.get("/", (req, res, next) => {
  return res.status(200).json({
    message: "Hello from root!",
  });
});

app.get("/path", (req, res, next) => {
  return res.status(200).json({
    message: "Hello from path!",
  });
});

app.use('/api', authRoutes);
app.use('/api', fileRoutes);
app.use('/api', folderRoutes);
app.use('/api', contactRoutes);
app.use('/api', sharedFileRoutes);
app.use('/api', conversationRoutes);

// Configuración de opciones preflight
app.options('*', cors(corsOptions));

app.use((req, res, next) => {
  return res.status(404).json({
    error: "Not Found",
  });
});

io.on('connection', (socket) => {
  console.log('Nuevo usuario conectado');
  
  // Manejo de conexión
  handleConnection(socket);

  // Manejo de desconexión
  socket.on('disconnect', () => {
    handleDisconnect(socket);
  });
});


// Escucha del servidor con websockets
server.listen(3000, () => {
  console.log('Servidor escuchando en el puerto 3000');
});

module.exports.handler = serverless(app);
