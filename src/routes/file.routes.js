const Router = require("express");
const multer = require('multer');

const { validateSchema } = require("../middlewares/validate.middleware");
const {
  getAllFiles,
  getFile,
  createFile,
  updateFile,
  deleteFile,
  addAccessUser,
  removeAccessUser,
  setFilePath,
  saveAudioBlobAsWAV,
  saveAudioFile
} = require("../controllers/file.controller");
const { createFileSchema, updateFileSchema } = require("../schemas/file.schema");
const { isAuth } =  require('../middlewares/auth.middleware')


const router = Router();
const upload = multer()

// // Middleware para configurar encabezados CORS
// router.use((req, res, next) => {
//     // Configura los encabezados CORS
//     res.setHeader('Access-Control-Allow-Origin', '*');
//     res.setHeader('Access-Control-Allow-Credentials', true);

//     // Continúa con el flujo de la solicitud
//     next();
//   });

router.get('/all-files', getAllFiles)

router.get('/files/:id', getFile)

router.post("/files",  isAuth, validateSchema(createFileSchema),createFile);

router.put("/files/:id", validateSchema(updateFileSchema), updateFile);

router.delete("/files/:id", deleteFile);

router.post('/add-user', addAccessUser);

router.post('/remove-user', removeAccessUser);

router.put('/set-file-path', setFilePath);

 router.post('/save-wav', upload.any(), saveAudioBlobAsWAV);

 router.post('/save-file',saveAudioFile);

module.exports = router;
