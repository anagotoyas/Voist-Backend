const { pool } = require("../db");

const shareFileWithContact = async (req, res, next) => {
  try {
    const fileId = req.params.fileId;
    const contactId = req.params.contactId;

    // Verificar si el usuario que solicita la compartición es el propietario del archivo
    const file = await pool.query("SELECT user_id FROM file WHERE id = $1", [
      fileId,
    ]);

    if (file.rowCount === 0) {
      return res
        .status(404)
        .json({ message: "No existe un archivo con ese ID" });
    }

    if (file.rows[0].user_id !== req.userId) {
      return res
        .status(403)
        .json({ message: "No tienes permiso para compartir este archivo" });
    }

    // Registrar la relación en la tabla shared_file
    const result = await pool.query(
      "INSERT INTO shared_file (file_id, owner_id, contact_id) VALUES ($1, $2, $3) RETURNING *",
      [fileId, req.userId, contactId]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({
        message: "No se pudo compartir el archivo con el contacto especificado",
      });
    }

    return res.status(200).json({ message: "Archivo compartido con éxito" });
  } catch (error) {
    next(error);
  }
};

const unshareFileWithContact = async (req, res, next) => {
  try {
    const fileId = req.params.fileId; // ID del archivo a dejar de compartir
    const contactId = req.params.contactId; // ID del contacto con el que dejar de compartir el archivo

    // Verificar si el usuario que solicita dejar de compartir es el propietario del archivo
    const file = await pool.query("SELECT user_id FROM file WHERE id = $1", [
      fileId,
    ]);

    if (file.rowCount === 0) {
      return res
        .status(404)
        .json({ message: "No existe un archivo con ese ID" });
    }

    if (file.rows[0].user_id !== req.userId) {
      return res.status(403).json({
        message: "No tienes permiso para dejar de compartir este archivo",
      });
    }

    // Eliminar la relación de la tabla shared_file
    const result = await pool.query(
      "DELETE FROM shared_file WHERE file_id = $1 AND owner_id = $2 AND contact_id = $3",
      [fileId, req.userId, contactId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message:
          "No se pudo dejar de compartir el archivo con el contacto especificado",
      });
    }

    return res
      .status(200)
      .json({ message: "Dejar de compartir archivo exitoso" });
  } catch (error) {
    next(error);
  }
};

const getFileInfo = async (req, res, next) => {
  try {
    const userId = req.userId; // Tu ID de usuario
    const fileId = req.params.fileId; // El ID del archivo específico que deseas consultar

    const result = await pool.query(
      "SELECT users.name, users.gravatar, users.email, users.id " +
        "FROM shared_file " +
        "INNER JOIN users ON shared_file.contact_id = users.id " +
        "WHERE shared_file.file_id = $1 AND shared_file.owner_id = $2",
      [fileId, userId]
    );

   

    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};
const getContactsNotSharedWithFile = async (req, res, next) => {
  try {
    const fileId = req.params.fileId;
    const userId = req.userId;

    const result = await pool.query(
      `
        SELECT c.id, u.name, u.email, u.gravatar
        FROM contact c
        JOIN users u ON c.contact_id = u.id
        WHERE c.owner_id = $1
        AND c.contact_id NOT IN (
          SELECT sf.contact_id
          FROM shared_file sf
          WHERE sf.file_id = $2
          AND sf.owner_id = $1
        )
      `,
      [userId, fileId]
    );

    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};
const getContactsListWithStatus = async (req, res, next) => {
  try {
    const userId = req.userId;
    const fileId = req.params.fileId;

    const result = await pool.query(
      `
        SELECT u.id, u.name, u.email, u.gravatar,
               CASE
                 WHEN sf.contact_id IS NOT NULL THEN true
                 ELSE false
               END AS has_access
        FROM users u
        LEFT JOIN shared_file sf
        ON u.id = sf.contact_id AND sf.file_id = $1 AND sf.owner_id = $2
        WHERE u.id IN (SELECT contact_id FROM contact WHERE owner_id = $2)
        `,
      [fileId, userId]
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  shareFileWithContact,
  unshareFileWithContact,
  getFileInfo,
  getContactsNotSharedWithFile,
  getContactsListWithStatus,
};
