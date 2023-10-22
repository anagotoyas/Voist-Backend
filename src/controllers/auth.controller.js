const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { createAccessToken } = require('../libs/jwt');
const md5 = require('md5');

const signin = async (req, res) => {
    const { email, password } = req.body;

    const result = await pool.query('SELECT * FROM users WHERE email = $1',[email]);

    if (result.rowCount === 0) {
        return res.status(400).json({
            message: 'El correo no está registrado'
        });
    }
    const validPassword = await bcrypt.compare(password, result.rows[0].password);

    if (!validPassword) {
        return res.status(400).json({
            message: 'La contraseña es incorrecta'
        });
    }
    const token = await createAccessToken({ id: result.rows[0].id });
    res.cookie('token', token, {
        // httpOnly: true,
        sameSite: 'none',
        secure: true,
        maxAge: 1000 * 60 * 60 * 24 // 1 day
    });
    return res.json(result.rows[0]);
    
};

const signup = async (req, res, next) => {
    const { name, email, password } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const gravatar = `https://www.gravatar.com/avatar/${md5(email)}`;

        const result = await pool.query('INSERT INTO users(name, email, password, gravatar) VALUES ($1, $2, $3, $4) RETURNING *', [name, email, hashedPassword, gravatar]);

        const token = await createAccessToken({ id: result.rows[0].id });

        res.cookie('token', token, {
            // httpOnly: true,
            sameSite: 'none',
            secure: true,
            maxAge: 1000 * 60 * 60 * 24 // 1 day
        });

        return res.json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({
                message: 'El email ya está registrado'
            });
        }
        next(error);
    }
};

const signout = (req, res) => {
    res.clearCookie('token');
    return res.sendStatus(200);
};

const profile = async (req, res) => {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);

    return res.json(result.rows[0]);
};
//
module.exports ={
    signin,
    signup,
    signout,
    profile
}
