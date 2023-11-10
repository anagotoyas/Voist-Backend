const { pool } = require("../db");

const createConversation = async (req, res) => {
  const { question, answer, file_id } = req.body;
 

  //db insert
  try {
    const result = await pool.query(
      " INSERT INTO conversation (question, answer, file_id, user_id) VALUES ($1, $2, $3, $4) RETURNING *",
      [question, answer, file_id, req.userId]
    );
    res.json(result.rows[0]);
  } catch (error) {
    return res.status(400).send(error);
  }
};

const getConversationByFile = async (req, res) => {
  const { file_id } = req.params;
  try {
    const result = await pool.query(
      "SELECT * FROM conversation WHERE file_id = $1 and user_id = $2",
      [file_id, req.userId]
    );
    res.json(result.rows);
  } catch (error) {
    return res.status(400).send("No se encontraron conversaciones");
  }
};

module.exports = {
  createConversation,
  getConversationByFile,
};
