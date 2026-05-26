'use strict';

const { Op } = require('sequelize');
const User = require('../models/user');
const Message = require('../models/message');

async function saveMessage(req, res) {
    const params = req.body;
    if (!params.text || !params.receiver) {
        return res.status(200).send({ message: 'Please, send the message text and receiver...' });
    }
    try {
        const message = await Message.create({
            emitterId: parseInt(req.user.sub),
            receiverId: parseInt(params.receiver),
            text: params.text,
            viewed: false,
        });
        return res.status(200).send({ message });
    } catch (err) {
        return res.status(500).send({ message: 'Sending message error...' });
    }
}

async function getReceivedMessages(req, res) {
    const userId = parseInt(req.user.sub);
    const itemsPerPage = 10;
    const page = parseInt(req.params.page) || 1;
    const offset = (page - 1) * itemsPerPage;
    try {
        const { count, rows } = await Message.findAndCountAll({
            where: { receiverId: userId },
            limit: itemsPerPage,
            offset,
            order: [['createdAt', 'DESC']],
            include: [{ model: User, as: 'emitter' }],
        });
        if (!rows || rows.length === 0) {
            return res.status(404).send({ message: 'No messages...' });
        }
        return res.status(200).send({
            total: count,
            pages: Math.ceil(count / itemsPerPage),
            messages: rows,
        });
    } catch (err) {
        return res.status(500).send({ message: 'Get messages error...' });
    }
}

async function getEmmitMessages(req, res) {
    const userId = parseInt(req.user.sub);
    const itemsPerPage = 10;
    const page = parseInt(req.params.page) || 1;
    const offset = (page - 1) * itemsPerPage;
    try {
        const { count, rows } = await Message.findAndCountAll({
            where: { emitterId: userId },
            limit: itemsPerPage,
            offset,
            order: [['createdAt', 'DESC']],
            include: [
                { model: User, as: 'emitter' },
                { model: User, as: 'receiver' },
            ],
        });
        if (!rows || rows.length === 0) {
            return res.status(404).send({ message: 'No messages...' });
        }
        return res.status(200).send({
            total: count,
            pages: Math.ceil(count / itemsPerPage),
            messages: rows,
        });
    } catch (err) {
        return res.status(500).send({ message: 'Get messages error...' });
    }
}

async function getConversation(req, res) {
    const userId = parseInt(req.user.sub);
    const userId2 = parseInt(req.params.user);
    const itemsPerPage = 30;
    const page = parseInt(req.params.page) || 1;
    const offset = (page - 1) * itemsPerPage;
    try {
        const { count, rows } = await Message.findAndCountAll({
            where: {
                emitterId: { [Op.in]: [userId, userId2] },
                receiverId: { [Op.in]: [userId, userId2] },
            },
            limit: itemsPerPage,
            offset,
            order: [['createdAt', 'DESC']],
            include: [
                { model: User, as: 'emitter' },
                { model: User, as: 'receiver' },
            ],
        });
        if (!rows || rows.length === 0) {
            return res.status(404).send({ message: 'No messages...' });
        }
        return res.status(200).send({
            total: count,
            pages: Math.ceil(count / itemsPerPage),
            messages: rows,
        });
    } catch (err) {
        return res.status(500).send({ message: 'Get messages error...' });
    }
}

async function getConversation2(req, res) {
    const userId = parseInt(req.user.sub);
    const itemsPerPage = 30;
    const page = parseInt(req.params.page) || 1;
    const offset = (page - 1) * itemsPerPage;
    try {
        const { count, rows } = await Message.findAndCountAll({
            where: {
                [Op.or]: [
                    { emitterId: userId },
                    { receiverId: userId },
                ],
            },
            limit: itemsPerPage,
            offset,
            order: [['createdAt', 'DESC']],
            include: [
                { model: User, as: 'emitter' },
                { model: User, as: 'receiver' },
            ],
        });
        if (!rows || rows.length === 0) {
            return res.status(404).send({ message: 'No messages...' });
        }
        return res.status(200).send({
            total: count,
            pages: Math.ceil(count / itemsPerPage),
            messages: rows,
        });
    } catch (err) {
        return res.status(500).send({ message: 'Get messages error...' });
    }
}

async function getUnviewedMessages(req, res) {
    const userId = parseInt(req.user.sub);
    try {
        const unviewed = await Message.count({ where: { receiverId: userId, viewed: false } });
        return res.status(200).send({ unviewed });
    } catch (err) {
        return res.status(500).send({ message: 'Get messages error...' });
    }
}

async function setViewedMessages(req, res) {
    const userId = parseInt(req.user.sub);
    try {
        const messages = await Message.update(
            { viewed: true },
            { where: { receiverId: userId, viewed: false } }
        );
        return res.status(200).send({ messages });
    } catch (err) {
        return res.status(500).send({ message: 'Set messages error...' });
    }
}

module.exports = {
    saveMessage,
    getReceivedMessages,
    getEmmitMessages,
    getUnviewedMessages,
    setViewedMessages,
    getConversation,
    getConversation2,
};
