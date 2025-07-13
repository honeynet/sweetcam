const sequelize = require('./database/database');
const { User } = require('./model/user');

async function testDatabaseConnection() {
    try {
        console.log('Testing database connection...');
        
        // Test basic connection
        await sequelize.authenticate();
        console.log('✅ Database connection successful');
        
        // Test User model
        await User.sync();
        console.log('✅ User model synchronized');
        
        // Test finding a user
        const user = await User.findOne({ where: { name: 'admin' } });
        if (user) {
            console.log('✅ Found user:', user.name);
        } else {
            console.log('⚠️  No admin user found');
        }
        
        // Test counting users
        const userCount = await User.count();
        console.log('✅ Total users in database:', userCount);
        
        console.log('✅ All database tests passed');
        
    } catch (error) {
        console.error('❌ Database test failed:', error.message);
        console.error('Error details:', error);
    } finally {
        await sequelize.close();
    }
}

testDatabaseConnection(); 