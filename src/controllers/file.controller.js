const { pool } = require("../db");
const fs = require("fs");
const wav = require("wav");
const path = require("path");

const getAllFiles = async (req, res, next) => {
  const result = await pool.query("SELECT * FROM file where user_id = $1", [
    req.userId,
  ]);

  return res.json(result.rows);
};

const getFile = async (req, res) => {
  const result = await pool.query("SELECT * FROM file where id=$1", [
    req.params.id,
  ]);

  if (result.rowCount === 0) {
    return res.status(404).json({ message: "No existe un archivo con ese id" });
  }
  return res.json(result.rows[0]);
};

const createFile = async (req, res, next) => {
  const { title } = req.body;
  

  //db insert
  try {
    const result = await pool.query(
      " INSERT INTO file (title, user_id) VALUES ($1, $2) RETURNING *",
      [title, req.userId]
    );
    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).send("Ya existe un archivo con ese titulo");
    }
    next(error);
  }
};

const updateFile = async (req, res) => {
  const { title } = req.body;

  const result = await pool.query(
    "UPDATE file SET title=$1 WHERE id=$2 RETURNING *",
    [title, req.params.id]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ message: "No existe el archivo con ese id" });
  }

  return res.json({
    message: "Archivo actualizado",
  });
};

const deleteFile = async (req, res) => {
  const result = await pool.query("DELETE FROM file where id=$1", [
    req.params.id,
  ]);

  if (result.rowCount === 0) {
    return res.status(404).json({ message: "No existe el archivo con ese id" });
  }

  return res.sendStatus(204);
};

const addAccessUser = async (req, res) => {
  const { fileId, userId } = req.body;

  const fileResult = await pool.query("SELECT * FROM file WHERE id = $1", [
    fileId,
  ]);

  if (fileResult.rowCount === 0) {
    return res.status(404).json({ message: "No existe un archivo con ese id" });
  }

  const userResult = await pool.query("SELECT * FROM users WHERE id = $1", [
    userId,
  ]);

  if (userResult.rowCount === 0) {
    return res.status(404).json({ message: "No existe un usuario con ese id" });
  }

  const file = fileResult.rows[0];

  if (file.user_id === userId) {
    return res.status(400).json({
      message: "El creador del archivo no puede ser agregado a 'people_access'",
    });
  }

  let peopleAccess = file.people_access;

  if (!Array.isArray(peopleAccess)) {
    // Si peopleAccess no es un array, crea uno nuevo con el userId
    peopleAccess = [userId];
  } else if (peopleAccess.includes(userId)) {
    return res
      .status(400)
      .json({ message: "El usuario ya tiene acceso al archivo" });
  } else {
    peopleAccess.push(userId);
  }

  const updateResult = await pool.query(
    "UPDATE file SET people_access = $1 WHERE id = $2 RETURNING *",
    [peopleAccess, fileId]
  );

  return res.json(updateResult.rows[0]);
};

const removeAccessUser = async (req, res) => {
  const { fileId, userId } = req.body;

  const fileResult = await pool.query("SELECT * FROM file WHERE id = $1", [
    fileId,
  ]);

  if (fileResult.rowCount === 0) {
    return res.status(404).json({ message: "No existe un archivo con ese id" });
  }

  const userResult = await pool.query("SELECT * FROM users WHERE id = $1", [
    userId,
  ]);

  if (userResult.rowCount === 0) {
    return res.status(404).json({ message: "No existe un usuario con ese id" });
  }

  const file = fileResult.rows[0];

  if (file.user_id === userId) {
    return res.status(400).json({
      message:
        "El creador del archivo no puede ser eliminado de 'people_access'",
    });
  }

  let peopleAccess = file.people_access;

  if (peopleAccess === null) {
    peopleAccess = [];
  }

  const updatedAccess = peopleAccess.filter((accessId) => accessId !== userId);

  if (peopleAccess.length === updatedAccess.length) {
    return res
      .status(400)
      .json({ message: "El usuario no tiene acceso al archivo" });
  }

  const updateResult = await pool.query(
    "UPDATE file SET people_access = $1 WHERE id = $2 RETURNING *",
    [updatedAccess, fileId]
  );

  return res.json(updateResult.rows[0]);
};

const setFilePath = async (req, res) => {
  const { fileId, filePath } = req.body;

  const fileResult = await pool.query("SELECT * FROM file WHERE id = $1", [
    fileId,
  ]);

  if (fileResult.rowCount === 0) {
    return res.status(404).json({ message: "No existe un archivo con ese id" });
  }

  const updateResult = await pool.query(
    "UPDATE file SET file_path = $1 WHERE id = $2 RETURNING *",
    [filePath, fileId]
  );

  return res.json(updateResult.rows[0]);
};

const saveAudioBlobAsWAV = async (req, res) => {
  const { audioData, name } = req.body;

  if (!name) {
    return res.status(400).json({ message: "Debe proporcionar un nombre de archivo" });
  }
  

  const fileName = `records/${name}.wav`; 

  const binaryData = Buffer.from(audioData, "base64");

 
  fs.mkdir(path.dirname(fileName), { recursive: true }, (err) => {
    if (err) { 
      console.error(err);
      res.status(500).json({ message: "Error al crear el directorio" });
    } else {
      
      fs.writeFile(fileName, binaryData, "binary", (err) => {
        // console.log(binaryData)
        if (err) {
          console.error(err);
          res.status(500).json({ message: "Error al guardar el archivo" });
        } else {
          res.json({ message: "Archivo WAV guardado con éxito" });
        }
      });
    } 
  });
};

const saveAudioFile = (req, res) => {
  const formData = req.body; // Asegúrate de que req.body contenga el FormData
  const audioBlob = formData.get("audioBlob");
  if (!audioBlob) {
    return res.status(400).send("Campo audioBlob no encontrado en el FormData");
  }

  const fileName = audioBlob.name;
  console.log(fileName);
  res.status(200).send("yup");
};

module.exports = {
  getAllFiles,
  getFile,
  createFile,
  updateFile,
  deleteFile,
  addAccessUser,
  removeAccessUser,
  setFilePath,
  saveAudioBlobAsWAV,
  saveAudioFile,
};
