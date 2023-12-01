const { pool } = require("../db");


const getAllAttachedFiles = async (req, res, next) => {
    const {fileId} = req.params
  const result = await pool.query("SELECT * FROM attached_file where file_id = $1", [
    fileId,
  ]); 
 
//   console.log(idFile)
  return res.json(result.rows); 
};

module.exports = {
    getAllAttachedFiles,
}