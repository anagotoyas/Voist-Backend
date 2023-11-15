const socketIo = require("socket.io");
const { pool } = require("./db");
const { format } = require("date-fns");

const clients = new Map();

const handleConnection = (socket) => {
  console.log(socket.handshake.auth);
  const user = clients.get(socket.handshake.auth.user);
  if (user) return;

  clients.set(socket.handshake.auth.user.id, {
    id: socket.handshake.auth.user.id,
    startTime: new Date(),
  });

  console.log(`Cliente conectado: ${socket.id}`);
};

const handleDisconnect = async (socket) => {
  try {
    const user = clients.get(socket.handshake.auth.user.id);

    if (user) {
      const disconnectedDate = new Date();
      const connectedDate = user.startTime;

      const differenceInMinutes =
        (disconnectedDate - connectedDate) / (1000 * 60);

      const loggedTime = await pool.query(
        "SELECT id, minutes FROM logged_time WHERE user_id = $1 AND created_at = $2",
        [user.id, format(new Date(), "yyyy-MM-dd")]
      );

      if (loggedTime.rowCount > 0) {
        const currentMinutes = loggedTime.rows[0].minutes;

        const totalMinutes = parseFloat(currentMinutes) + differenceInMinutes;

        await pool.query("UPDATE logged_time SET minutes = $1 WHERE id = $2", [
          totalMinutes,
          loggedTime.rows[0].id,
        ]);
      } else {
        await pool.query(
          "INSERT INTO logged_time (user_id, minutes, created_at) VALUES ($1, $2, $3)",
          [user.id, differenceInMinutes, format(new Date(), "yyyy-MM-dd")]
        );
      }

      clients.delete(socket.handshake.auth.user.id);
      console.log(`Cliente desconectado: ${socket.id}`);
    }
  } catch (error) {
    console.log(error);
  }
};

module.exports = { handleConnection, handleDisconnect };
