'use strict';

require('dotenv').config();

const required = ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE', 'JWT_SECRET'];
for (const key of required) {
    if (!process.env[key]) {
        console.error(`Missing required env var: ${key}`);
        process.exit(1);
    }
}

const sequelize = require('./config/database');
const app = require('./app');
const port = process.env.PORT || 3000;

console.log('Starting...');

sequelize.authenticate()
    .then(() => {
        console.log('DB: MySQL connected OK!');
        return sequelize.sync();
    })
    .then(() => {
        app.listen(port, () => {
            console.log('Server running on =>' + port);
        });
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
