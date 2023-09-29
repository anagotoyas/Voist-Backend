const pg = require('pg');

const pool = new pg.Pool({
    port: 5432,
    host: 'instancebdd.cjmhkya27ir2.us-east-1.rds.amazonaws.com',
    user: 'postgres',
    password: 'db-voist',
    database: 'db_voist',
});

pool.on("connect", () => {
    console.log("Database connected");
});

module.exports = { pool };
