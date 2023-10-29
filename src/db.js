const pg = require('pg');

const dotenv = require("dotenv");
dotenv.config();

const port = process.env.DB_PORT;
const host = process.env.DB_HOST;
const user = process.env.DB_USERNAME;
const password = process.env.DB_PASSWORD;
const db = process.env.DB_DATABASE;

const pool = new pg.Pool({
    port: port,
    host: host,
    user: user,
    password: password,
    database: db,
});

pool.on("connect", () => {
    console.log("Database connected");
});

module.exports = { pool };
