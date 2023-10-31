
const Router = require("express");

const {
     shareFileWithContact,
    unshareFileWithContact,
    getFileInfo,
    getContactsNotSharedWithFile
} = require("../controllers/sharedFile.controller");

const { isAuth } =  require('../middlewares/auth.middleware')

const router = Router();




router.post("/share/:fileId/:contactId", isAuth, shareFileWithContact);

router.delete("/unshare/:fileId/:contactId",isAuth, unshareFileWithContact);

router.get("/info/:fileId",isAuth, getFileInfo);

router.get("/notshared/:fileId", isAuth,getContactsNotSharedWithFile);


module.exports = router;






