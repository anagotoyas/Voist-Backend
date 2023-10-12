const { pool } = require("../db");
const fs = require("fs");
const wav = require("wav");
const path = require("path");
const sdk = require("microsoft-cognitiveservices-speech-sdk");

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

const saveAudioFile = (req, res) => {
  const audioFile = req.files
  id=req.params.id
  

  if (!audioFile) {
    return res.status(400).send('No se ha proporcionado ningún archivo de audio.');
  }
 
  // Aquí puedes acceder al Blob de audio como un objeto Buffer:
  const audioBuffer = audioFile[0].buffer;

  // El resto de tu código para guardar el archivo debería permanecer igual
  const archivosDir = path.join('records');
  const fileName = `${id}.wav`;
  const filePath = path.join(archivosDir, fileName);
  // ...

  // Guarda el archivo WAV en el servidor.
  fs.writeFile(filePath, audioBuffer, (err) => {
    if (err) {
      // console.error("Error al guardar el archivo WAV:", err);
      res.status(500).send("Error al guardar el archivo WAV");
    } else {
      // console.log("Archivo WAV guardado exitosamente en:", filePath);
      fromFile(filePath,res)
      res.status(200).send("Archivo WAV guardado exitosamente");
    }
  });
};


const fromFile = async (wavFilePath, res) => {
 

  const speechConfig = sdk.SpeechConfig.fromSubscription(
    "40f160f190fa418d82711ac6df2ab6ec",
    "eastus"
  );
  speechConfig.speechRecognitionLanguage = "es-ES";

  console.log(wavFilePath);

  let audioConfig = sdk.AudioConfig.fromWavFileInput(
    fs.readFileSync(wavFilePath)
  );

  

  let speechRecognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
  console.log(speechRecognizer);

  speechRecognizer.recognizeOnceAsync((result) => {
    switch (result.reason) {
      case sdk.ResultReason.RecognizedSpeech:
        console.log(`RECOGNIZED: Text=${result.text}`);
        // Puedes enviar el resultado como respuesta en JSON si lo deseas
        res.json({
          message: "Archivo WAV guardado con éxito",
          recognitionResult: result.text,
        });
        break;
      case sdk.ResultReason.NoMatch:
        console.log("NOMATCH: Speech could not be recognized.");
        break;
      case sdk.ResultReason.Canceled:
        const cancellation = sdk.CancellationDetails.fromResult(result);
        console.log(`CANCELED: Reason=${cancellation.reason}`);

        if (cancellation.reason == sdk.CancellationReason.Error) {
          console.log(`CANCELED: ErrorCode=${cancellation.ErrorCode}`);
          console.log(`CANCELED: ErrorDetails=${cancellation.errorDetails}`);
          console.log(
            "CANCELED: Did you set the speech resource key and region values?"
          );
        }
        break;
    }
    speechRecognizer.close();
  });
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
  saveAudioFile,
};
