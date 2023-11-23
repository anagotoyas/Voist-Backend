const { pool } = require("../db");

const getAllFolders = async (req, res, next) => {
  const result = await pool.query("SELECT * FROM folder where user_id = $1", [
    req.userId,
  ]);

  return res.json(result.rows);
};

const getFolder = async (req, res) => {
  const result = await pool.query("SELECT * FROM folder where id=$1", [
    req.params.id,
  ]);

  if (result.rowCount === 0) {
    return res.status(404).json({ message: "No existe un folder con ese id" });
  }
  return res.json(result.rows[0]);
};

const createFolder = async (req, res, next) => {
  const { title } = req.body;

  //db insert
  try {
    const result = await pool.query(
      " INSERT INTO folder (title, user_id) VALUES ($1, $2) RETURNING *",
      [title, req.userId]
    );
    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).send("Ya existe un folder con ese titulo");
    }
    next(error);
  }
};

const updateFolder = async (req, res) => {
  const { title } = req.body;

  const result = await pool.query(
    "UPDATE folder SET title=$1, updated_at=now() WHERE id=$2 RETURNING *",
    [title, req.params.id]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ message: "No existe el folder con ese id" });
  }

  return res.json({
    message: "Folder actualizado",
  });
};

const deleteFolder = async (req, res) => {
  try {
    // Obtener IDs de archivos en el folder
    const fileIdsResult = await pool.query(
      "SELECT id FROM file WHERE folder_id = $1",
      [req.params.id]
    );

    const fileIds = fileIdsResult.rows.map((file) => file.id);

    await pool.query("DELETE FROM conversation WHERE file_id = ANY($1)", [fileIds]);

    await pool.query("DELETE FROM shared_file WHERE file_id = ANY($1)", [fileIds]);


    // Eliminar los archivos en el folder
    await pool.query("DELETE FROM file WHERE folder_id = $1", [req.params.id]);

    // Eliminar el folder
    const result = await pool.query("DELETE FROM folder WHERE id = $1", [
      req.params.id,
    ]);

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ message: "No existe el folder con ese id" });
    }

    return res.sendStatus(204);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error al eliminar el folder" });
  }
};

module.exports = {
  getAllFolders,
  getFolder,
  createFolder,
  updateFolder,
  deleteFolder,
};
