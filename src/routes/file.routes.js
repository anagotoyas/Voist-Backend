const Router = require("express");
const multer = require("multer");

const { validateSchema } = require("../middlewares/validate.middleware");
const {
  getAllFiles,
  getAllFilesByFolder,
  getFile,
  createFile,
  updateFile,
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
  juntarTextos
} = require("../controllers/file.controller");
const {
  createFileSchema,
  updateFileSchema,
} = require("../schemas/file.schema");
const { isAuth } = require("../middlewares/auth.middleware");

const router = Router();
const upload = multer();

// // Middleware para configurar encabezados CORS
// router.use((req, res, next) => {
//     // Configura los encabezados CORS
//     res.setHeader('Access-Control-Allow-Origin', '*');
//     res.setHeader('Access-Control-Allow-Credentials', true);

//     // Continúa con el flujo de la solicitud
//     next();
//   });

router.get("/all-files", isAuth, getAllFiles);

router.get("/all-files/:idFolder", isAuth, getAllFilesByFolder);

router.get("/files/:id", getFile);

router.post("/files", isAuth, createFile);

router.put("/files/:id", validateSchema(updateFileSchema), updateFile);

router.delete("/files/:id", deleteFile);

router.post("/add-user", addAccessUser);

router.post("/remove-user", removeAccessUser);

router.put("/set-file-path", setFilePath);

router.post("/save-file/:id", upload.any(), saveAudioFile);

router.post('/subir-archivos/:id', upload.any(), attachedFiles);


router.get("/files-contact", isAuth, getFilesForContact);

router.post("/createSummary", createSummary);

router.get("/files-month", getFilesPerMonth);

router.get("/files-count", countFiles); 

router.get("/juntar-textos/:id", juntarTextos); 



module.exports = router;
