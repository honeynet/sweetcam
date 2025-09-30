const bcrypt = require("bcrypt");
const sequelize = require('../database/database');

const addUser = async (name, password) => {
    try {
        const saltRounds = 10
        const passwordHash = await bcrypt.hash(password, saltRounds)
        const [result] = await sequelize.query(
            'INSERT INTO users (name, passwordHash) VALUES (?, ?)',
            {
                replacements: [name, passwordHash],
                type: sequelize.QueryTypes.INSERT
            }
        );
        return {id: result.insertId, name: name}
    } catch (error) {
        console.error('Error adding user:', error);
        throw error;
    }
}

const findUserPasswordHashByName = async (name) => {
    try {
        const [results] = await sequelize.query(
            'SELECT passwordHash FROM users WHERE name = ?',
            {
                replacements: [name],
                type: sequelize.QueryTypes.SELECT
            }
        );
        return results.length > 0 ? results[0].passwordHash : null;
    } catch (error) {
        console.error('Database connection error in findUserPasswordHashByName:', error);
        throw error;
    }
}

const findUserPasswordHashesByName = async (name) => {
    try {
        const results = await sequelize.query(
            'SELECT passwordHash FROM users WHERE name = ?',
            {
                replacements: [name],
                type: sequelize.QueryTypes.SELECT
            }
        );
        return results.map(result => result.passwordHash);
    } catch (error) {
        console.error('Database connection error in findUserPasswordHashesByName:', error);
        throw error;
    }
}

const validateUserPassword = async (username, password) => {
    try {
        const passwordHashes = await findUserPasswordHashesByName(username);
        if (!passwordHashes || passwordHashes.length === 0) {
            return false;
        }
        
        for (const hash of passwordHashes) {
            if (await bcrypt.compare(password, hash)) {
                return true;
            }
        }
        return false;
    } catch (error) {
        console.error('Error validating user password:', error);
        throw error;
    }
}

const getNumberOfUsers = async () => {
    try {
        const [results] = await sequelize.query(
            'SELECT COUNT(*) as count FROM users',
            {
                type: sequelize.QueryTypes.SELECT
            }
        );
        return results[0].count;
    } catch (error) {
        console.error('Database connection error in getNumberOfUsers:', error);
        throw error;
    }
}

module.exports = { findUserPasswordHashByName, findUserPasswordHashesByName, validateUserPassword, addUser, getNumberOfUsers}