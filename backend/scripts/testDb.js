const db = require('../config/db');

async function testConnection() {
  console.log('🔄 Testing database connection...');
  try {
    const [rows] = await db.query('SELECT 1 + 1 AS result');
    console.log('✅ Connected successfully to MySQL database!');

    const [tables] = await db.query('SHOW TABLES');
    console.log(`📋 Found ${tables.length} table(s) in the database:`);
    tables.forEach(t => console.log('  -', Object.values(t)[0]));

    console.log('\n🎉 Database is ready for Expire Reminder!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Database connection failed:');
    console.error(err.message);
    process.exit(1);
  }
}

testConnection();
