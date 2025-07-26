module.exports = {
    HOST: process.env.DB_HOST || "172.18.0.2",
    USER: process.env.DB_USER || "root",
    PASSWORD: process.env.DB_PASSWORD || "rootpassword",
    DB: process.env.DB_NAME || "sweetcam",
    PORT: process.env.DB_PORT || 3306,
    dialect: "mysql",
    pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
    },
    retry: {
        max: 3,
        timeout: 10000
    },
    dialectOptions: {
        connectTimeout: 60000,
        acquireTimeout: 60000,
        timeout: 60000,
        reconnect: true
    }
} 