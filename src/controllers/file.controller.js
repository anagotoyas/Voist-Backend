const { pool } = require("../db");
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const fs = require("fs");

const multer = require("multer");
const path = require("path");
const sdk = require("microsoft-cognitiveservices-speech-sdk");
const WaveFile = require("wavefile").WaveFile;
const aws = require("aws-sdk");
const pdf = require("pdf-parse");
require("aws-sdk/lib/maintenance_mode_message").suppress = true;
const dotenv = require("dotenv");
dotenv.config();

const region = process.env.AWS_REGION;
const bucketName = process.env.AWS_BUCKET_NAME;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const azureKey = process.env.AZURE_KEY;
const azureRegion = process.env.AZURE_REGION;

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
  const only_files = req.body.only_files;
  const idFolder = req.body.idFolder;

  const folderValue =
    idFolder === null || idFolder === undefined ? null : idFolder;

  const onlyFilesValue = only_files === null || only_files === undefined ? false : only_files;

  //db insert
  try {
    const result = await pool.query(
      " INSERT INTO file (title, user_id, folder_id, only_files) VALUES ($1, $2, $3, $4) RETURNING *",
      [title, req.userId, folderValue,onlyFilesValue]
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
    "UPDATE file SET title=$1, updated_at=now() WHERE id=$2 RETURNING *",
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
  await pool.query("DELETE FROM conversation WHERE file_id = $1", [
    req.params.id,
  ]);

  await pool.query("DELETE FROM attached_file WHERE file_id = $1", [
    req.params.id,
  ]);

  await pool.query("DELETE FROM shared_file WHERE file_id = $1", [
    req.params.id,
  ]);

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

  // const s3 = new aws.S3({
  //   region,
  //   accessKeyId,
  //   secretAccessKey,
  // });

  // const recordfileName = `audio/${id}.wav`;

  // const params = {
  //   Bucket: "voist-records",
  //   Key: recordfileName,
  //   Body: audioBuffer,
  // };

  fs.writeFile(filePath, audioBuffer, async (err) => {
    if (err) {
      console.log("error al guardar el archivo: " + err);
      res.status(500).send("Error al guardar el archivo WAV");
    } else {
      await fromFile(filePath, res, id, formattedDuration);
    }
  });
};

const fromFile = async (wavFilePath, res, idFile, durationInSeconds) => {
  console.log("comienzo fromfile");
  const audioConfig = sdk.AudioConfig.fromWavFileInput(
    fs.readFileSync(wavFilePath)
  );

  const speechConfig = sdk.SpeechConfig.fromSubscription(azureKey, azureRegion);
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
      // res.status(500).json({
      //   message: "NOMATCH: No se pudo reconocer el discurso.",
      // });
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
    console.log("Comenzando a crear el PDF");

    const result = {
      success: false,
      message: "",
      pdfURL: null,
    };

    try {
      const pdfURL = await createAndUploadPDF(
        recognizedText,
        idFile,
        "transcripts"
      );

      console.log(pdfURL.toString());

      const query = `
          UPDATE file 
          SET transcript = $1, duration = $2
          WHERE id = $3
          RETURNING *
        `;

      await pool.query(query, [pdfURL.toString(), durationInSeconds, idFile]);

      fs.unlink(wavFilePath, (err) => {
        console.log(wavFilePath);
        if (err) {
          console.error(`Error al eliminar el archivo: ${err}`);
        } else {
          result.success = true;
          result.message = "Transcripción actualizada";
          result.pdfURL = pdfURL;

          console.log("termino fromfile");

          res.status(200).json(result);
        }
      });
    } catch (error) {
      res.status(500);
    }
    recognizer.stopContinuousRecognitionAsync();
  };

  recognizer.startContinuousRecognitionAsync();
};

const createAndUploadPDF = async (content, id, bucket) => {
  try {
    console.log("comienzo createAndUploadPDF");
    // console.log(content);
    console.log(id);
    console.log(bucket);

    const normalizedText = content
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const pageWidth = 595;
    const pageHeight = 842;

    const lineHeight = 20;

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const margin = 50;
    let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    const paragraphs = normalizedText.split(/\n+/);

    for (const paragraph of paragraphs) {
      const words = paragraph.split(/\s+/);
      let line = "";

      for (const word of words) {
        const currentLine = line + (line ? " " : "") + word;
        const textSize = font.widthOfTextAtSize(currentLine, 12);

        if (textSize > pageWidth - 2 * margin) {
          currentPage.drawText(line, {
            x: margin,
            y,
            size: 12,
            color: rgb(0, 0, 0),
          });
          y -= lineHeight;

          if (y - lineHeight < margin) {
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
        y -= lineHeight;

        if (y - lineHeight < margin) {
          currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
        }
      }
    }

    const fileName = `${bucket}/${id}.pdf`;

    const pdfBytes = await pdfDoc.save();

    const s3 = new aws.S3({
      region,
      accessKeyId,
      secretAccessKey,
    });

    const params = {
      Bucket: "voist-records", // replace with your S3 bucket name
      Key: fileName,
      Body: pdfBytes,
      ContentType: "application/pdf",
    };

    console.log("termino createAndUploadPDF");

    const result = await s3.upload(params).promise();
    return result.Location;
  } catch (error) {
    console.error("Error al subir el PDF a S3:", error);

    // Log the stack trace for better debugging
    console.error(error.stack);

    // You can rethrow the error if you want it to be caught by higher-level error handling
    // throw error;

    // Or you can return a custom error response or value, depending on your use case
    return null;
  }
};

const createSummary = async (req, res, next) => {
  const { content, id, bucket, atributo } = req.body;
  const pdfURL = await createAndUploadPDF(content, id, bucket);

  // db insert
  try {
    const query = `
          UPDATE file 
          SET ${atributo}  = $1 
          WHERE id = $2
          RETURNING *
        `;

    await pool.query(query, [pdfURL.toString(), id]);
    res.json({ message: "resumen guardardo", pdfUrl: pdfURL });
  } catch (error) {
    res.status(error.status).json(error.message);
  }
};

const getFilesForContact = async (req, res, next) => {
  try {
    const contactId = req.userId;

    const query = `
    SELECT f.*, false AS owner
    FROM file f
    JOIN shared_file sf ON f.id = sf.file_id
    WHERE sf.contact_id = $1
    `;

    const result = await pool.query(query, [contactId]);

    return res.status(200).json(result.rows);
  } catch (error) {
    res.status(500);
  }
};

const getFilesPerMonth = async (req, res, next) => {
  const currentYear = new Date().getFullYear();
  const query = `SELECT DATE_TRUNC('month', created_at) AS month, 
  COUNT(*) AS file_count FROM file 
  WHERE EXTRACT(YEAR FROM "created_at") = $1
      GROUP BY month
      ORDER BY month;`;

  const result = await pool.query(query, [currentYear]);
  return res.json(result.rows);
};

const countFiles = async (req, res, next) => {
  const currentYear = new Date().getFullYear();
  const query = `SELECT COUNT(*) AS file_count FROM file 
  WHERE EXTRACT(YEAR FROM "created_at") = $1`;

  const result = await pool.query(query, [currentYear]);
  return res.json(result.rows[0]);
};

// Función para extraer texto de un PDF
const extraerTextoPDF = async (s3File) => {
  const { PdfReader } = await import("pdfreader");
  return new Promise((resolve, reject) => {
    const pdfReader = new PdfReader();
    let textoPDF = "";

    pdfReader.parseBuffer(s3File.Body, (err, item) => {
      if (err) {
        reject(err);
      } else if (!item) {
        resolve(textoPDF);
      } else if (item.text) {
        textoPDF += " " + item.text.replace(/[^\x00-\x7F]/g, "");
      }
    });
  });
};

const attachedFiles = async (req, res, next) => {
  console.log("comienzo attachedFiles");
  const id = req.params.id;

  const enlacesArchivos = [];
  let contenido_archivos = "";

  try {
    const s3 = new aws.S3({
      region,
      accessKeyId,
      secretAccessKey,
    });

    await Promise.all(
      req.files.map(async (file, index) => {
        const fileName = `archivos/${file.originalname}`;

        const nombreArchivo = file.originalname;

        const params = {
          Bucket: "voist-records",
          Key: fileName,
          Body: file.buffer,
          ContentType: "application/pdf",
        };

        const result = await s3.upload(params).promise(); 
        enlacesArchivos.push(result.Location);

        const s3Params = {
          Bucket: "voist-records",
          Key: fileName,
        };

        const s3File = await s3.getObject(s3Params).promise();

        const textoPDF = await extraerTextoPDF(s3File);
        contenido_archivos += `Archivo ${index + 1}: ${textoPDF}\n`;

        const insertQuery = `INSERT INTO attached_file (file_id, link, file_name) VALUES ($1, $2, $3)`;
        await pool.query(insertQuery, [id, result.Location, nombreArchivo]);
      })
    );
    console.log("attached files creados");

    const normalizedText = contenido_archivos
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    // const transcriptPdf = `transcripts/${id}.pdf`;

    // const s3ParamsTranscript = {
    //   Bucket: "voist-records",
    //   Key: transcriptPdf,
    // };

    // const s3FileTranscript = await s3.getObject(s3ParamsTranscript).promise();
    // const textoTranscript = await extraerTextoPDF(s3FileTranscript);

    // const totalText = `Texto de los archivos adjuntos o material de clase: ${normalizedText} Texto de la transcripcion: ${textoTranscript}`;

    // const totalNormalizedText = totalText
    //   .normalize("NFD")
    //   .replace(/[\u0300-\u036f]/g, "");

    const pdfURL = await createAndUploadPDF(normalizedText, id, "contenido");
    // const pdfURLTotal = await createAndUploadPDF(
    //   totalNormalizedText,
    //   id,
    //   "total"
    // );

    console.log("juntar textos");

    try {
      const query = `
        UPDATE file 
        SET content = $1,
       
        have_files = true
        WHERE id = $2
        RETURNING *;
      `;

      const dbResult = await pool.query(query, [pdfURL.toString(), id]);
      console.log("contenido guardado");
      res.json({
        message: "Contenido guardado",
        pdfUrl: pdfURL,
        dbResult: dbResult.rows,
      });
    } catch (error) {
      res.status(500).json({
        error: "Error al actualizar la base de datos",
        errorMessage: error.message,
      });
    }
  } catch (error) {
    console.error("Error al procesar archivos:", error);
    res.status(500).json({ error: "Error al procesar archivos" });
  }
};

const juntarTextos = (req, res) => {
  const id = req.params.id;
  const transcriptPdf = `transcripts/${id}.pdf`;
  const contenidoPdf = `contenido/${id}.pdf`;

  const s3ParamsTranscript = {
    Bucket: "voist-records",
    Key: transcriptPdf,
  };

  const s3ParamsContenido = {
    Bucket: "voist-records",
    Key: contenidoPdf,
  };

  const s3 = new aws.S3({
    region,
    accessKeyId,
    secretAccessKey,
  });

  const s3FileTranscript = s3.getObject(s3ParamsTranscript).promise();
  const s3FileContenido = s3.getObject(s3ParamsContenido).promise();

  Promise.all([s3FileTranscript, s3FileContenido])
    .then(async (results) => {
      const textoTranscript = await extraerTextoPDF(results[0]);
      const textoContenido = await extraerTextoPDF(results[1]);

      console.log(textoContenido);
      console.log(textoTranscript);

      const totalText = `Texto de los archivos adjuntos o material de clase: ${textoContenido} Texto de la transcripcion: ${textoTranscript}`;

      const totalNormalizedText = totalText
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      const pdfURLTotal = createAndUploadPDF(totalNormalizedText, id, "total");

      return pdfURLTotal;
    })
    .then((pdfURLTotal) => {
      const query = `
        UPDATE file 
        SET total_content = $1
        WHERE id = $2
        RETURNING *;
      `;

      pool
        .query(query, [pdfURLTotal.toString(), id])
        .then((dbResult) => {
          res.json({
            message: "Contenido guardado",
            pdfUrl: pdfURLTotal,
            dbResult: dbResult.rows,
          });
        })
        .catch((error) => {
          res.status(500).json({
            error: "Error al actualizar la base de datos",
            errorMessage: error.message,
          });
        });
    })
    .catch((error) => {
      console.error("Error al procesar archivos:", error);
      res.status(500).json({ error: "Error al procesar archivos" });
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
  saveAudioFile,
  getFilesForContact,
  createSummary,
  getFilesPerMonth,
  countFiles,
  attachedFiles,
  juntarTextos,
};
