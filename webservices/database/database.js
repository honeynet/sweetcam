const dbConfig = require("../config/db-config");
const {Sequelize} = require("sequelize")

const sequelize = new Sequelize(
    dbConfig.DB,
    dbConfig.USER,
    dbConfig.PASSWORD,
    {
        host: dbConfig.HOST,
        dialect: dbConfig.dialect,
        port: dbConfig.port,
        pool: {
            max: 10,           // Maximum number of connection instances to create
            min: 0,            // Minimum number of connection instances to create
            acquire: 60000,    // Maximum time, in milliseconds, that pool will try to get connection before throwing error
            idle: 10000,       // Maximum time, in milliseconds, that a connection can be idle before being released
            evict: 60000       // How often to run eviction checks for idle connections
        },
        retry: {
            max: 3,            // Maximum retry attempts
            timeout: 10000     // Timeout for retry attempts
        },
        dialectOptions: {
            connectTimeout: 60000
        },
        logging: false,        // Disable SQL query logging to reduce overhead
        benchmark: false       // Disable query benchmarking
    }
)

// Test the connection
sequelize.authenticate()
    .then(() => {
        console.log('[DATABASE] Database connection established successfully.');
    })
    .catch(err => {
        console.error('[DATABASE] Unable to connect to the database:', err);
    });

module.exports = sequelize