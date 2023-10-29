const Router = require("express");
const {
  getContactList,
  addContact,
  deleteContact,
} = require("../controllers/contact.controller");



const router = Router();

router.get("/contacts/:userId", getContactList);
router.post("/add", addContact);
router.delete("/contacts/:contact_id/:owner_id",deleteContact);

module.exports = router;
