const { pool } = require("../db");
const fs = require("fs");
const path = require("path");
const sdk = require("microsoft-cognitiveservices-speech-sdk");
const WaveFile = require("wavefile").WaveFile;
const AWS = require("aws-sdk");
require("aws-sdk/lib/maintenance_mode_message").suppress = true;
require("dotenv").config();
const WavDecoder = require('wav-decoder');
const axios = require('axios');


AWS.config.update({
  AWS_PUBLIC_KEY: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_REGION: process.env.AWS_REGION,
  AWS_BUCKET_NAME: process.env.AWS_BUCKET_NAME,
});

const getAllFiles = async (req, res, next) => {
  const result = await pool.query(
    "SELECT * FROM file where user_id = $1 and folder_id IS NULL",
    [req.params.id]
  );

  return res.json(result.rows);
};
const getAllFilesByFolder = async (req, res, next) => {
  const result = await pool.query(
    "SELECT * FROM file where user_id = $1 and folder_id =$2",
    [req.params.id, req.params.idFolder]
  );

  return res.json(result.rows);
};
const getAllFilesByKeyword = async (req, res, next) => {
  const searchKeyword = req.params.keyword;
  const userId = req.params.id;

  const query = `
    SELECT * FROM file
    WHERE user_id = $1
    AND folder_id IS NULL
    AND title LIKE '%' || $2 || '%';
  `;

  try {
    const result = await pool.query(query, [userId, searchKeyword]);
    // El resultado de la consulta estará en "result.rows"
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
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
  const idFolder = req.body.idFolder;

  const folderValue =
    idFolder === null || idFolder === undefined ? null : idFolder;

  //db insert
  try {
    const result = await pool.query(
      " INSERT INTO file (title, user_id, folder_id) VALUES ($1, $2, $3) RETURNING *",
      [title, req.params.id, folderValue]
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
  
  const audioFile = req.files;
  id = req.params.id;

  if (!audioFile) {
    return res
      .status(400)
      .send("No se ha proporcionado ningún archivo de audio.");
  }

  // Aquí puedes acceder al Blob de audio como un objeto Buffer:
  const audioBuffer = audioFile[0].buffer;

  // Crea un objeto WaveFile desde el buffer del audio.
  const waveFile = new WaveFile(audioBuffer);

  const s3 = new AWS.S3();

  // El nombre del archivo en S3 (puedes personalizarlo)
  const s3ObjectKey = `${id}.wav`;

  const params = {
    Bucket: "voist-transcripts", // Reemplaza con el nombre de tu bucket de S3
    Key: s3ObjectKey,
    Body: audioBuffer,
  };

  // Sube el archivo de audio a S3
  s3.upload(params, (err, data) => {
    if (err) {
      console.error("Error al subir el archivo a S3:", err);
      res.status(500).send("Error al guardar el archivo en S3");
    } else {
      // El archivo se ha subido exitosamente a S3
      // Puedes acceder a la URL del archivo en data.Location
      const s3FileURL = data.Location;
      console.log("Enlace del archivo en S3:", s3FileURL); // Muestra el enlace en la consola
      console.log(res)

      // Resto de tu código para responder al cliente
      fromFile(s3FileURL, res, id, 3);
    }
  });
};

const wavURL='https://voist-transcripts.s3.amazonaws.com/1326.wav';



const fromFile = async (wavURL, id, durationInSeconds) => {
  try {
    const response = await axios.get(wavURL, { responseType: "arraybuffer" });
    console.log(response.status)

    if (response.status === 200) {
      const audioBuffer = new Uint8Array(response.data);
      
      const filePath = path.join( 'records', `${id}.wav`);
      fs.writeFileSync(filePath, Buffer.from(audioBuffer));

      // Configura el reconocedor de voz con el archivo WAV local
      const speechConfig = sdk.SpeechConfig.fromSubscription(
        "40f160f190fa418d82711ac6df2ab6ec",
        "eastus"
      );
      speechConfig.speechRecognitionLanguage = "es-ES";

      const audioConfig = sdk.AudioConfig.fromWavFileInput(filePath);
      const speechRecognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

      speechRecognizer.recognizeOnceAsync(async (result) => {
        switch (result.reason) {
          case ResultReason.RecognizedSpeech:
            try {
              await pool.query(
                "UPDATE file SET transcript = $1, duration = $2 WHERE id = $3 RETURNING *",
                [result.text, durationInSeconds, id]
              );
              console.log(result.text);
              // Realiza alguna acción con el resultado de la transcripción

            } catch (error) {
              console.error("Error al actualizar la transcripción:", error);
            }

            break;
          case ResultReason.NoMatch:
            console.log("NOMATCH: Speech could not be recognized.");
            break;
          case ResultReason.Canceled:
            const cancellation = CancellationDetails.fromResult(result);
            console.log(`CANCELED: Reason=${cancellation.reason}`);
            if (cancellation.reason == CancellationReason.Error) {
              console.error(`CANCELED: ErrorCode=${cancellation.ErrorCode}`);
              console.error(`CANCELED: ErrorDetails=${cancellation.errorDetails}`);
            }
            break;
        }
        speechRecognizer.close();
      });
    } else {
      console.error("Error al descargar el archivo desde S3");
    }
  } catch (error) {
    console.error("Error al analizar el archivo:", error);
  }
};
fromFile(wavURL, 1326,3)

module.exports = {
  getAllFiles,
  getFile,
  createFile,
  updateFile,
  getAllFilesByFolder,
  deleteFile,
  addAccessUser,
  removeAccessUser,
  setFilePath,
  saveAudioFile,
  getAllFilesByKeyword,
};
