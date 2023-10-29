const { pool } = require("../db");

const getContactList = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const result = await pool.query(
      "SELECT contact.id, contact.owner_id, contact.contact_id, users.name AS contact_name, users.email AS contact_email, users.gravatar AS contact_gravatar " +
        "FROM contact " +
        "INNER JOIN users ON contact.contact_id = users.id " +
        "WHERE contact.owner_id = $1",
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

const addContact = async (req, res, next) => {
  try {
    const { contact_id, owner_id } = req.body;
    

    if (owner_id === contact_id) {
      return res
        .status(400)
        .json({ message: "No puedes agregarte a ti mismo como contacto." });
    }

    const existingContact = await pool.query(
      "SELECT * FROM contact WHERE owner_id = $1 AND contact_id = $2",
      [owner_id, contact_id]
    );

    if (existingContact.rowCount > 0) {
      return res
        .status(400)
        .json({ message: "La relación de contacto ya existe." });
    }

    const result = await pool.query(
      "INSERT INTO contact (owner_id, contact_id) VALUES ($1, $2) RETURNING *",
      [owner_id, contact_id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

const deleteContact = async (req, res, next) => {
  try {
    
    const contact_id = req.params.contact_id;
    const owner_id = req.params.owner_id;

    const existingContact = await pool.query(
      "SELECT * FROM contact WHERE owner_id = $1 AND contact_id = $2",
      [owner_id, contact_id]
    );

    if (existingContact.rowCount === 0) {
      return res
        .status(404)
        .json({
          message: "No existe la relación de contacto con esos IDs.",
          owner_id: `El owner id es: ${owner_id}`,
        });
    }

    await pool.query(
      "DELETE FROM contact WHERE owner_id = $1 AND contact_id = $2",
      [owner_id, contact_id]
    );

    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
};

const getUsersWithContactStatus = async (req, res, next) => {
  try {
    const userId = req.params.userId; 

   
    const query = `
      SELECT users.id, users.name, users.email, users.gravatar,
             (contact.id IS NOT NULL) AS is_contact
      FROM users
      LEFT JOIN contact ON (users.id = contact.contact_id AND contact.owner_id = $1)
    `;

    const result = await pool.query(query, [userId]);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};


module.exports = {
  getContactList,
  addContact,
  deleteContact,
  getUsersWithContactStatus
};
