const bcrypt = require("bcryptjs");
const { pool } = require("../db");
const { createAccessToken } = require("../libs/jwt");
const md5 = require("md5");
const { format } = require("date-fns");
const aws = require("aws-sdk");
const dotenv = require("dotenv");
dotenv.config();

const region = process.env.AWS_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

const signin = async (req, res) => {
  const { email, password } = req.body;

  const result = await pool.query("SELECT * FROM users WHERE email = $1", [
    email,
  ]);

  if (result.rowCount === 0) {
    return res.status(400).json({
      message: "El correo no está registrado",
    });
  }
  const validPassword = await bcrypt.compare(password, result.rows[0].password);

  if (!validPassword) {
    return res.status(400).json({
      message: "La contraseña es incorrecta",
    });
  }
  const token = await createAccessToken({ id: result.rows[0].id });
  res.cookie("token", token, {
    // httpOnly: true,
    // sameSite: 'none',
    // secure: false,
    // maxAge: 1000 * 60 * 60 * 24
    httpOnly: false,
    sameSite: "none",
    secure: true,
    maxAge: 1000 * 60 * 60 * 24,
  });
  return res.json(result.rows[0]);
};

const signup = async (req, res, next) => {
  const { name, email, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const gravatar = `https://www.gravatar.com/avatar/${md5(email)}`;

    const result = await pool.query(
      "INSERT INTO users(name, email, password, gravatar) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, email, hashedPassword, gravatar]
    );

    const token = await createAccessToken({ id: result.rows[0].id });

    res.cookie("token", token, {
      // httpOnly: true,
      // sameSite: 'none',
      // secure: false,
      // maxAge: 1000 * 60 * 60 * 24
      httpOnly: false,
      sameSite: "none",
      secure: true,
      maxAge: 1000 * 60 * 60 * 24,
    });

    return res.json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(400).json({
        message: "El email ya está registrado",
      });
    }
    next(error);
  }
};

const signout = (req, res) => {
  res.clearCookie("token");
  return res.sendStatus(200);
};

const profile = async (req, res) => {
  const result = await pool.query("SELECT * FROM users WHERE id = $1", [
    req.userId,
  ]);

  return res.json(result.rows[0]);
};

const countUsers = async (req, res) => {
  const result = await pool.query("SELECT COUNT(*) FROM users where role=2");

  return res.json(result.rows[0]);
};

const countNewUsers = async (req, res) => {
  const hoy = new Date();

  const primerDiaSemana = new Date(hoy);

  const ultimoDiaSemana = new Date(hoy);

  const diaSemana = hoy.getDay();

  primerDiaSemana.setDate(hoy.getDate() - diaSemana);
  ultimoDiaSemana.setDate(hoy.getDate() + (6 - diaSemana));
  const count = await getCountBetween(
    new Date(format(primerDiaSemana, "MM/dd/yyyy")),
    new Date(format(ultimoDiaSemana, "MM/dd/yyyy"))
  );
  return res.json({ count });
};

async function getCountBetween(startDate, endDate) {
  try {
    const query = `
        SELECT COUNT(*) AS count
        FROM users
        WHERE role= 2
          AND created_at >= $1
          AND created_at <= $2;
      `;

    const result = await pool.query(query, [startDate, endDate]);
    const count = result.rows[0].count;

    return count;
  } catch (error) {
    console.error(error);
    throw new Error("Error fetching count");
  }
}

const findAllUsers = (req, res) => {
  const { filter, limit, page } = req.query;

  // Convertir limit y page a números enteros
  const limitInt = parseInt(limit, 10);
  const pageInt = parseInt(page, 10);

  // Construye la consulta SQL para contar la cantidad total de usuarios
  const countQuery = `
      SELECT COUNT(*) AS total
      FROM users
      WHERE (name ILIKE $1 OR email ILIKE $1) AND role = 2
    `;

  pool.query(countQuery, [`%${filter}%`], (countError, countResults) => {
    if (countError) {
      throw countError;
    }

    const total = countResults.rows[0].total;

    // Construye la consulta SQL para obtener los usuarios paginados
    const usersQuery = `
        SELECT *
        FROM users
       WHERE (name ILIKE $1 OR email ILIKE $1) AND role = 2
        ORDER BY id
        LIMIT $2 OFFSET $3;
      `;

    pool.query(
      usersQuery,
      [`%${filter}%`, limitInt, (pageInt - 1) * limitInt],
      (queryError, queryResults) => {
        if (queryError) {
          throw queryError;
        }

        res.status(200).json({
          total,
          users: queryResults.rows,
        });
      }
    );
  });
};

const findUser = (req, res) => {
  const { id } = req.params;

  const query = `
      SELECT *
      FROM users
      WHERE id = $1;
    `;

  pool.query(query, [id], (error, results) => {
    if (error) {
      throw error;
    }

    res.status(200).json(results.rows[0]);
  });
};

const findTimeByUserId = (req, res) => {
  const { id } = req.params;
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const query = {
    text: `
        SELECT * 
        FROM logged_time 
        WHERE created_at >= $1 AND user_id = $2 
        ORDER BY created_at ASC
      `,
    values: [sevenDaysAgo, id],
  };

  pool.query(query, (error, results) => {
    if (error) {
      throw error;
    }

    res.status(200).json(results.rows);
  });
};

const editProfile = async (req, res) => {
  const { name, email, currentPassword } = req.body;

  const result = await pool.query("SELECT * FROM users WHERE id = $1", [
    req.userId,
  ]);

  const validPassword = await bcrypt.compare(
    currentPassword,
    result.rows[0].password
  );

  if (!validPassword) {
    return res.status(200).json({
      error: "La contraseña es incorrecta",
    });
  } else {
    if (req.files.length === 0) {
      console.log("sin imagen");
      const query = {
        text: `
          UPDATE users
          SET name = $1, email = $2
          WHERE id = $3 RETURNING *
        `,
        values: [name, email, req.userId],
      };

      pool.query(query, (error, results) => {
        if (error) {
          console.error("Error en la consulta SQL:", error);
          return res.status(500).json({ error: "Error interno del servidor" });
        }

        const updatedUser = results.rows[0];
        res
          .status(200)
          .json({ message: "Perfil actualizado con éxito", user: updatedUser });
      });
    } else {
      const image = req.files[0].buffer;

      const originalName = req.files[0].originalname;

      const s3 = new aws.S3({
        region,
        accessKeyId,
        secretAccessKey,
      });

      const fileName = `images/${req.userId}_${originalName}.png`;

      const params = {
        Bucket: "voist-records",
        Key: fileName,
        Body: image,
      };

      try {
        const result = await s3.upload(params).promise();

        const query = {
          text: `
            UPDATE users
            SET name = $1, email = $2, gravatar = $3
            WHERE id = $4 RETURNING *
          `,
          values: [name, email, result.Location, req.userId],
        };

        pool.query(query, (error, results) => {
          if (error) {
            console.error("Error en la consulta SQL:", error);
            return res
              .status(500)
              .json({ error: "Error interno del servidor" });
          }

          const updatedUser = results.rows[0];
          res
            .status(200)
            .json({
              message: "Perfil actualizado con éxito",
              user: updatedUser,
            });
        });

        console.log(result.Location);
        return result.Location;
      } catch (error) {
        console.error("Error al subir la imagen a S3:", error);
        return res.status(500).json({ error: "Error interno del servidor" });
      }
    }
  }
};

const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const result = await pool.query("SELECT * FROM users WHERE id = $1", [
    req.userId,
  ]);

  const validPassword = await bcrypt.compare(
    currentPassword,
    result.rows[0].password
  );

  if (!validPassword) {
    return res.status(200).json({ error: "Invalid current password" });
  }

  // Hash the new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  try {
    const query = {
      text: `
        UPDATE users
        SET password = $1
        WHERE id = $2
      `,
      values: [hashedPassword, req.userId],
    };

    pool.query(query, (error, results) => {
      if (error) {
        console.error("Error en la consulta SQL:", error);
        return res.status(500).json({ error: "Error interno del servidor" });
      }

      return res.status(200).json({ message: "Password updated successfully" });
    });
  } catch (error) {
    return res.status(500).json({ error: "Error interno del servidor" });
  }
};

//
module.exports = {
  signin,
  signup,
  signout,
  profile,
  countUsers,
  countNewUsers,
  findAllUsers,
  findUser,
  findTimeByUserId,
  editProfile,
  changePassword
};
