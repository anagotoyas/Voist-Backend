
const Router = require("express");

const {
  getAllAttachedFiles,  
} = require("../controllers/attached_file.controller");

const { isAuth } =  require('../middlewares/auth.middleware')

const router = Router();




router.get("/attachedFiles/:fileId",getAllAttachedFiles);


module.exports = router;






