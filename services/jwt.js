'use strict';

var jwt = require('jwt-simple');
var moment = require('moment');
const secret = process.env.JWT_SECRET;

exports.createtoken = function (user) {
    var payload = {
        sub: user.id,
        name: user.name,
        surname: user.surname,
        nick: user.nick,
        email: user.email,
        role: user.role,
        image: user.image,
        iat: moment().unix(),
        expired: moment().add(3, 'days').unix()
    };
    return jwt.encode(payload, secret);
};
