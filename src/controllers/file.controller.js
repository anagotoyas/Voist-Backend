const { pool } = require("../db");
const fs = require("fs");
const path = require("path");
const sdk = require("microsoft-cognitiveservices-speech-sdk");
const WaveFile = require("wavefile").WaveFile;
const aws = require('aws-sdk')
const dotenv = require('dotenv');
dotenv.config()

const region = process.env.AWS_REGION
const bucketName = process.env.AWS_BUCKET_NAME
const accessKeyId = process.env.AWS_ACCESS_KEY_ID
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY

const getAllFiles = async (req, res, next) => {
  const result = await pool.query("SELECT * FROM file where user_id = $1 and folder_id IS NULL", [
    req.userId
  ]);
 
  return res.json(result.rows);
};
const getAllFilesByFolder = async (req, res, next) => {
  const result = await pool.query("SELECT * FROM file where user_id = $1 and folder_id =$2", [
    req.userId, req.params.idFolder
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
  const idFolder = req.body.idFolder

  const folderValue = idFolder === null || idFolder === undefined ? null : idFolder;


  //db insert
  try {
    const result = await pool.query(
      " INSERT INTO file (title, user_id, folder_id) VALUES ($1, $2, $3) RETURNING *",
      [title, req.userId, folderValue]
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

  const sampleRate = waveFile.fmt.sampleRate;
  const chunkSize = waveFile.data.chunkSize;

 
  const durationInSeconds =
    chunkSize /
    (((sampleRate * waveFile.fmt.bitsPerSample) / 8) *
      waveFile.fmt.numChannels);


  const hours = Math.floor(durationInSeconds / 3600);
  const minutes = Math.floor((durationInSeconds % 3600) / 60);
  const seconds = Math.floor(durationInSeconds % 60);

  
  const formattedDuration = `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

 
  const archivosDir = path.join("records");
  const fileName = `${id}.wav`;
  const filePath = path.join(archivosDir, fileName);

  const s3 = new aws.S3({
    region,
    accessKeyId,
    secretAccessKey,

  })
  

  fs.writeFile(filePath, audioBuffer, (err) => {
    if (err) {
      
      res.status(500).send("Error al guardar el archivo WAV");
    } else {

      s3.upload(
        {
          Bucket: bucketName,
          Key: `audios/${fileName}`, 
          Body: fs.createReadStream(filePath),
        },
        (uploadErr, data) => {
          if (uploadErr) {
            res.status(500).send("Error al cargar el archivo WAV a S3");
          } else {
            
            const s3Url = data.Location;
            console.log(s3Url)
            fromFile(filePath, res, id, formattedDuration);
            res.status(200).send("Archivo WAV guardado exitosamente en S3");
          }
        }
      );
    
      fromFile(filePath, res, id, formattedDuration);
      res.status(200).send("Archivo WAV guardado exitosamente");
    }
  });
};

const fromFile = async (wavFilePath, res, id, durationInSeconds) => {
  const speechConfig = sdk.SpeechConfig.fromSubscription(
    "40f160f190fa418d82711ac6df2ab6ec",
    "eastus" 
  );
  speechConfig.speechRecognitionLanguage = "es-ES";

  let audioConfig = sdk.AudioConfig.fromWavFileInput(
    fs.readFileSync(wavFilePath)
  );

  let speechRecognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

  speechRecognizer.recognizeOnceAsync(async (result) => {
    switch (result.reason) {
      case sdk.ResultReason.RecognizedSpeech:
        try {
          await pool.query(
            "UPDATE file SET transcript = $1, duration = $2 WHERE id = $3 RETURNING *",
            [result.text, durationInSeconds, id]
            
          );
          console.log(result.text);
          
          res.status(200).json({
            message: "Transcripción actualizada",
          });
        } catch (error) {
          res.status(500);
        }
        //
        break;
      case sdk.ResultReason.NoMatch:
        res.status(500).json({
          message: "NOMATCH: Speech could not be recognized.",
        });
        console.log("NOMATCH: Speech could not be recognized."); 

        break;
      case sdk.ResultReason.Canceled:
        const cancellation = sdk.CancellationDetails.fromResult(result);

        res.status(500).json({
          message: `CANCELED: Reason=${cancellation.reason}`,
        });

        if (cancellation.reason == sdk.CancellationReason.Error) {
          res.status(500).json({
            errorCode: `CANCELED: ErrorCode=${cancellation.ErrorCode}`,
            errorDetails: `CANCELED: ErrorDetails=${cancellation.errorDetails}`,
          });
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
  getAllFilesByFolder,
  deleteFile,
  addAccessUser,
  removeAccessUser,
  setFilePath,
  saveAudioFile
};
