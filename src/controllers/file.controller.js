const { pool } = require("../db");
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const fs = require("fs");
const multer = require("multer");
const path = require("path");
const sdk = require("microsoft-cognitiveservices-speech-sdk");
const WaveFile = require("wavefile").WaveFile;
const aws = require("aws-sdk");
require("aws-sdk/lib/maintenance_mode_message").suppress = true;
const dotenv = require("dotenv");
dotenv.config();

const region = process.env.AWS_REGION;
const bucketName = process.env.AWS_BUCKET_NAME;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

const getAllFiles = async (req, res, next) => {
  const result = await pool.query(
    "SELECT * FROM file where user_id = $1 and folder_id IS NULL",
    [req.userId]
  );

  return res.json(result.rows);
};
const getAllFilesByFolder = async (req, res, next) => {
  const result = await pool.query(
    "SELECT * FROM file where user_id = $1 and folder_id =$2",
    [req.userId, req.params.idFolder]
  );

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
  const idFolder = req.body.idFolder;

  const folderValue =
    idFolder === null || idFolder === undefined ? null : idFolder;

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

  const audioBuffer = audioFile[0].buffer;

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
  });

  const recordfileName = `audio/${id}.wav`;

  const params = {
    Bucket: "voist-records",
    Key: recordfileName,
    Body: audioBuffer,
  };

  fs.writeFile(filePath, audioBuffer, (err) => {
    if (err) {
      console.log(filePath);
      console.log(audioBuffer);
      res.status(500).send("Error al guardar el archivo WAV");
    } else {
      s3.upload(params, (err, data) => {
        if (err) {
          console.error("Error al subir el archivo a S3:", err);
          res.status(500).send("Error al guardar el archivo en S3");
        } else {
          const wavURL = data.Location;
          fromFile(filePath, res, id, formattedDuration, wavURL);

          res.status(200).send("Archivo WAV guardado exitosamente");
        }
      });
    }
  });
};

// function speechRecognizeContinuousFromFile(audioFilePath) {

//   const audioConfig = sdk.AudioConfig.fromWavFileInput(fs.readFileSync(audioFilePath));
//   console.log(audioFilePath)
//   console.log(audioConfig)
//   const speechConfig = sdk.SpeechConfig.fromSubscription('40f160f190fa418d82711ac6df2ab6ec', 'eastus');
//   speechConfig.speechRecognitionLanguage = "es-ES";
//   const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

//   console.log('vamonos')

//   let recognizedText = '';

//   recognizer.recognizing = (s, e) => {
//     console.log(`RECOGNIZING: ${e.result.text}`);
//   };

//   recognizer.recognized = (s, e) => {
//     if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
//       recognizedText += e.result.text + ' ';
//       console.log(`RECOGNIZED: ${e.result.text}`);
//     } else if (e.result.reason === sdk.ResultReason.NoMatch) {
//       console.log("No se encontró ninguna coincidencia.");
//     }
//   };

//   recognizer.canceled = (s, e) => {
//     console.log(`CANCELED: Reason=${e.reason}`);

//     if (e.reason === sdk.CancellationReason.Error) {
//       console.log(`CANCELED: ErrorCode=${e.errorCode}`);
//       console.log(`CANCELED: ErrorDetails=${e.errorDetails}`);
//     }

//     recognizer.stopContinuousRecognitionAsync(() => {
//       console.log('Fin de la transcripcion')
//       // Imprime el texto reconocido después de detener la transcripción
//       console.log("Texto reconocido: " + recognizedText);
//     });
//   };

//   recognizer.startContinuousRecognitionAsync();

//   console.log("Reconocimiento de voz continuo iniciado. Presiona Ctrl+C para detener.");

//   // Mantén la aplicación en funcionamiento
//   process.stdin.resume();
// }

// speechRecognizeContinuousFromFile('records/audio-youtube.wav');

const fromFile = async (
  wavFilePath,
  res,
  idFile,
  durationInSeconds,
  wavURL
) => {
  const audioConfig = sdk.AudioConfig.fromWavFileInput(
    fs.readFileSync(wavFilePath)
  );
  console.log(wavFilePath);
  console.log(audioConfig);

  const speechConfig = sdk.SpeechConfig.fromSubscription(
    "40f160f190fa418d82711ac6df2ab6ec",
    "eastus"
  );
  speechConfig.speechRecognitionLanguage = "es-ES";
  const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

  console.log("Comenzando reconocimiento continuo");

  let recognizedText = "";

  recognizer.recognizing = (s, e) => {
    console.log(`RECONOCIENDO: ${e.result.text}`);
  };

  recognizer.recognized = async (s, e) => {
    if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
      recognizedText += e.result.text + " ";
      console.log(`RECONOCIDO: ${e.result.text}`);
    } else if (e.result.reason === sdk.ResultReason.NoMatch) {
      console.log("No se encontró ninguna coincidencia.");
      res.status(500).json({
        message: "NOMATCH: No se pudo reconocer el discurso.",
      });
    }
  };

  recognizer.canceled = (s, e) => {
    console.log(`CANCELED: Reason=${e.reason}`);

    if (e.reason == sdk.CancellationReason.Error) {
      console.log(`CANCELED: ErrorCode=${e.errorCode}`);
      console.log(`CANCELED: ErrorDetails=${e.errorDetails}`);
      console.log("CANCELED: Did you update the subscription info?");
    }

    recognizer.stopContinuousRecognitionAsync();
  };

  recognizer.sessionStarted = (s, e) => {
    console.log("\n    Session started event.");
  };

  recognizer.sessionStopped = async (s, e) => {
    console.log("\n    Session stopped event.");
    console.log("\n    Stop recognition.");
    // console.log("Texto reconocido: " + recognizedText);
    try {
      const pdfURL = await createAndUploadPDF(recognizedText, idFile);

      const query = `
          UPDATE file 
          SET transcript = $1, duration = $2, file_path = $3
          WHERE id = $4
          RETURNING *
        `;

      await pool.query(query, [
        pdfURL.toString(),
        durationInSeconds,
        wavURL.toString(),
        idFile,
      ]);

      res.status(200).json({
        message: "Transcripción actualizada",
      });
    } catch (error) {
      res.status(500);
    }
    recognizer.stopContinuousRecognitionAsync();
  };

  recognizer.startContinuousRecognitionAsync();
};

const createAndUploadPDF = async (content, id) => {
  
  const pageWidth = 595;
  const pageHeight = 842;
  
  const lineHeight = 20;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const margin = 50;
  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const words = content.split(' ');
  let line = '';

  for (const word of words) {
    const currentLine = line + (line ? ' ' : '') + word;
    const textSize = font.widthOfTextAtSize(currentLine, 12);

    if (textSize > pageWidth - 2 * margin) {
      // La palabra no cabe en la línea actual, entonces agrega la línea actual al PDF
      currentPage.drawText(line, {
        x: margin,
        y,
        size: 12,
        color: rgb(0, 0, 0),
      });
      y -= lineHeight;

      if (y - lineHeight < margin) {
        // Cambia a una nueva página cuando el espacio se agota
        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }

      line = word;
    } else {
      line = currentLine;
    }
  }
  if (line) {
    currentPage.drawText(line, {
      x: margin,
      y,
      size: 12,
      color: rgb(0, 0, 0),
    });
  }

  const fileName = `transcripts/${id}.pdf`;

  const pdfBytes = await pdfDoc.save();

  const s3 = new aws.S3({
    region,
    accessKeyId,
    secretAccessKey,
  });

  const params = {
    Bucket: "voist-records",
    Key: fileName,
    Body: pdfBytes,
    ContentType: "application/pdf",
  };

  try {
    
    const result = await s3.upload(params).promise();
    return result.Location;
  } catch (error) {
    console.error("Error al subir el PDF a S3:", error);
  }
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
  saveAudioFile,
  
};
