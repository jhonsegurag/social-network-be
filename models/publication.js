'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./user');

const Publication = sequelize.define('Publication', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    text: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    file: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
    },
}, {
    tableName: 'publications',
    timestamps: true,
});

Publication.belongsTo(User, { foreignKey: 'userId', as: 'author' });

module.exports = Publication;
