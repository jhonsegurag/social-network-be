'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./user');

const Follow = sequelize.define('Follow', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
    },
    followedId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
    },
}, {
    tableName: 'follows',
    timestamps: true,
});

Follow.belongsTo(User, { foreignKey: 'userId', as: 'follower' });
Follow.belongsTo(User, { foreignKey: 'followedId', as: 'followedUser' });

module.exports = Follow;
