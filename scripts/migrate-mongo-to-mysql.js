'use strict';

require('dotenv').config();

const mongoose = require('mongoose');
const { Schema } = mongoose;

// ---------------------------------------------------------------------------
// 0. Startup validation
// ---------------------------------------------------------------------------

const REQUIRED_ENV = [
    'MONGODB_URL',
    'MYSQL_HOST', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE',
];
for (const key of REQUIRED_ENV) {
    if (!process.env[key]) {
        console.error(`Missing required env var: ${key}`);
        process.exit(1);
    }
}

// ---------------------------------------------------------------------------
// 1. Mongoose schemas (read-only source — defined inline, not imported from app)
// ---------------------------------------------------------------------------

const UserSchema = new Schema({
    name:     String,
    surname:  String,
    nick:     String,
    email:    String,
    password: String,
    role:     { type: String, default: 'ROLE_USER' },
    image:    String,
    created_at: String,
}, { strict: false });

const FollowSchema = new Schema({
    user:     { type: Schema.Types.ObjectId },
    followed: { type: Schema.Types.ObjectId },
    created_at: String,
}, { strict: false });

const PublicationSchema = new Schema({
    text:       String,
    file:       String,
    user:       { type: Schema.Types.ObjectId },
    created_at: String,
}, { strict: false });

const MessageSchema = new Schema({
    emitter:  { type: Schema.Types.ObjectId },
    receiver: { type: Schema.Types.ObjectId },
    text:     String,
    viewed:   Schema.Types.Mixed,
    created_at: String,
}, { strict: false });

// ---------------------------------------------------------------------------
// 2. Sequelize target models (imported from app — single source of truth)
// ---------------------------------------------------------------------------

// Must load after dotenv so MYSQL_* env vars are already set
const sequelize = require('../config/database');
const User        = require('../models/user');
const Follow      = require('../models/follow');
const Publication = require('../models/publication');
const Message     = require('../models/message');

// ---------------------------------------------------------------------------
// 3. Helpers
// ---------------------------------------------------------------------------

/**
 * Coerce legacy "true"/"false" strings (and booleans) to Boolean.
 * Any other value → false with a warning.
 */
function coerceViewed(value, id) {
    if (value === true  || value === 'true')  return true;
    if (value === false || value === 'false') return false;
    console.warn(`  WARN: unexpected viewed value "${value}" for _id=${id} — defaulting to false`);
    return false;
}

/**
 * Parse a legacy created_at string (or Date) to a JavaScript Date.
 * Falls back to new Date() and logs a warning if unparseable.
 */
function coerceDate(value, id) {
    if (!value) return new Date();
    const d = new Date(value);
    if (isNaN(d.getTime())) {
        console.warn(`  WARN: unparseable created_at "${value}" for _id=${id} — using current timestamp`);
        return new Date();
    }
    return d;
}

/**
 * Migrate a single collection, row by row.
 * @param {string}   label      - Display name for logging
 * @param {object[]} docs       - Array of Mongoose documents
 * @param {Function} buildRow   - (doc, idMap?) => plain object for Sequelize create
 * @param {object}   Model      - Sequelize model
 * @param {Map}      [idMap]    - Optional ObjectId → MySQL int id map to populate
 * @returns {{ attempted, inserted, failed }}
 */
async function migrateCollection(label, docs, buildRow, Model, idMap) {
    let inserted = 0;
    let failed = 0;

    for (const doc of docs) {
        try {
            const row = buildRow(doc, idMap);
            const created = await Model.create(row);
            if (idMap) {
                idMap.set(doc._id.toString(), created.id);
            }
            inserted++;
        } catch (err) {
            console.warn(`  WARN: insert failed for _id=${doc._id} (${label}) — ${err.message}`);
            failed++;
        }
    }

    const attempted = docs.length;
    console.log(`[${label.padEnd(12)}] attempted: ${attempted},  inserted: ${inserted},  failed: ${failed}`);
    return { attempted, inserted, failed };
}

// ---------------------------------------------------------------------------
// 4. Main
// ---------------------------------------------------------------------------

async function main() {
    // -- Connect to MongoDB --------------------------------------------------
    console.log('Connecting to MongoDB...');
    try {
        await mongoose.connect(process.env.MONGODB_URL, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
    } catch (err) {
        console.error(`ERROR: Could not connect to MongoDB — ${err.message}`);
        process.exit(1);
    }

    // -- Connect to MySQL ----------------------------------------------------
    console.log('Connecting to MySQL...');
    try {
        await sequelize.authenticate();
        // Sync without altering — tables must already exist from sequelize.sync() in index.js
        await sequelize.sync({ alter: false });
    } catch (err) {
        console.error(`ERROR: Could not connect to MySQL — ${err.message}`);
        await mongoose.disconnect();
        process.exit(1);
    }

    // -- Register Mongoose models --------------------------------------------
    const MongoUser        = mongoose.model('User',        UserSchema,        'users');
    const MongoFollow      = mongoose.model('Follow',      FollowSchema,      'follows');
    const MongoPublication = mongoose.model('Publication', PublicationSchema, 'publications');
    const MongoMessage     = mongoose.model('Message',     MessageSchema,     'messages');

    const results = [];
    let totalInserted = 0;
    let totalFailed = 0;

    // -------------------------------------------------------------------------
    // Step 1 — users (no FK deps)
    // -------------------------------------------------------------------------
    console.log('\nMigrating users...');
    const mongoUsers = await MongoUser.find({}).lean();
    const userIdMap  = new Map(); // ObjectId string → MySQL int id

    const usersResult = await migrateCollection(
        'users',
        mongoUsers,
        (doc) => ({
            name:      doc.name     || '',
            surname:   doc.surname  || '',
            nick:      doc.nick     || '',
            email:     doc.email    || '',
            password:  doc.password || '',
            role:      doc.role     || 'ROLE_USER',
            image:     doc.image    || null,
            createdAt: coerceDate(doc.created_at || doc.createdAt, doc._id),
        }),
        User,
        userIdMap,
    );
    results.push(usersResult);

    // -------------------------------------------------------------------------
    // Step 2 — follows (FK → users)
    // -------------------------------------------------------------------------
    console.log('\nMigrating follows...');
    const mongoFollows = await MongoFollow.find({}).lean();

    const followsResult = await migrateCollection(
        'follows',
        mongoFollows,
        (doc) => {
            const userId     = userIdMap.get(doc.user     ? doc.user.toString()     : '');
            const followedId = userIdMap.get(doc.followed ? doc.followed.toString() : '');
            if (!userId || !followedId) {
                throw new Error(`user or followed ObjectId not found in userIdMap (userId=${doc.user}, followed=${doc.followed})`);
            }
            return {
                userId,
                followedId,
                createdAt: coerceDate(doc.created_at || doc.createdAt, doc._id),
            };
        },
        Follow,
    );
    results.push(followsResult);

    // -------------------------------------------------------------------------
    // Step 3 — publications (FK → users)
    // -------------------------------------------------------------------------
    console.log('\nMigrating publications...');
    const mongoPublications = await MongoPublication.find({}).lean();

    const publicationsResult = await migrateCollection(
        'publications',
        mongoPublications,
        (doc) => {
            const userId = userIdMap.get(doc.user ? doc.user.toString() : '');
            if (!userId) {
                throw new Error(`user ObjectId not found in userIdMap (userId=${doc.user})`);
            }
            return {
                text:      doc.text || '',
                file:      doc.file || null,
                userId,
                createdAt: coerceDate(doc.created_at || doc.createdAt, doc._id),
            };
        },
        Publication,
    );
    results.push(publicationsResult);

    // -------------------------------------------------------------------------
    // Step 4 — messages (FK → users x2)
    // -------------------------------------------------------------------------
    console.log('\nMigrating messages...');
    const mongoMessages = await MongoMessage.find({}).lean();

    const messagesResult = await migrateCollection(
        'messages',
        mongoMessages,
        (doc) => {
            const emitterId  = userIdMap.get(doc.emitter  ? doc.emitter.toString()  : '');
            const receiverId = userIdMap.get(doc.receiver ? doc.receiver.toString() : '');
            if (!emitterId || !receiverId) {
                throw new Error(`emitter or receiver ObjectId not found in userIdMap (emitter=${doc.emitter}, receiver=${doc.receiver})`);
            }
            return {
                emitterId,
                receiverId,
                text:      doc.text || '',
                viewed:    coerceViewed(doc.viewed, doc._id),
                createdAt: coerceDate(doc.created_at || doc.createdAt, doc._id),
            };
        },
        Message,
    );
    results.push(messagesResult);

    // -------------------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------------------
    console.log('');
    for (const r of results) {
        totalInserted += r.inserted;
        totalFailed   += r.failed;
    }

    if (totalFailed === 0) {
        console.log(`Migration complete. Total: ${totalInserted} records migrated, 0 failed.`);
    } else {
        console.log(`Migration complete with errors. Total: ${totalInserted} records migrated, ${totalFailed} failed.`);
    }

    await mongoose.disconnect();
    await sequelize.close();

    process.exit(totalFailed === 0 ? 0 : 1);
}

main().catch((err) => {
    console.error(`ERROR: Unexpected failure — ${err.message}`);
    process.exit(1);
});
