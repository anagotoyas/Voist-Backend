const Router = require("express");
const {
  getContactList,
  addContact,
  deleteContact,
  getUsersWithContactStatus,
  getAllContacts
} = require("../controllers/contact.controller");

const { isAuth } =  require('../middlewares/auth.middleware')

const router = Router();

router.get("/contacts/:userId", getContactList);
router.get("/all-contacts", isAuth, getAllContacts);
router.post("/add", addContact);
router.delete("/contacts/:contact_id/:owner_id",deleteContact);
router.get('/usersWithContactStatus/:userId', getUsersWithContactStatus);


module.exports = router;
