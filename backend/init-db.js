require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function init() {
    const config = {
        host: process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
        user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
        password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
        database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'seat_allocation_v2_db',
        port: parseInt(process.env.DB_PORT || process.env.MYSQLPORT) || 3306,
        multipleStatements: true
    };

    console.log(`Connecting to database at ${config.host}:${config.port}...`);
    
    try {
        const connection = await mysql.createConnection(config);
        console.log('Connected!');

        const schemaPath = path.join(__dirname, '../sql/schema.sql');
        const proceduresPath = path.join(__dirname, '../sql/procedures.sql');

        console.log('Reading schema.sql...');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        
        console.log('Executing schema...');
        // We might need to handle the "USE database" statement if it's there
        await connection.query(schemaSql);
        console.log('Schema created successfully.');

        console.log('Reading procedures.sql...');
        const proceduresSql = fs.readFileSync(proceduresPath, 'utf8');
        
        console.log('Executing procedures...');
        await connection.query(proceduresSql);
        console.log('Procedures created successfully.');

        await connection.end();
        console.log('Database initialization complete!');
    } catch (err) {
        console.error('Error initializing database:', err);
        process.exit(1);
    }
}

init();
