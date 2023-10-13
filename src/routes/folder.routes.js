const Router = require("express");


const { validateSchema } = require("../middlewares/validate.middleware");
const {
  getAllFolders,
    getFolder,
    createFolder,
    updateFolder,
    deleteFolder,
} = require("../controllers/folder.controller");
const { createFolderSchema, updateFolderSchema } = require("../schemas/folder.schema");



const router = Router();


router.get('/all-folders/:id', getAllFolders)

router.get('/folders/:id', getFolder)

router.post("/folders/:id", validateSchema(createFolderSchema),createFolder);

router.put("/folders/:id", validateSchema(updateFolderSchema), updateFolder);

router.delete("/folders/:id", deleteFolder);


module.exports = router;