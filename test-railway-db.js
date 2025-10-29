const mysql = require('mysql2/promise');

async function testConnection() {
  const config = {
    host: 'gondola.proxy.rlwy.net',
    user: 'root',
    password: 'aQBboVZPiGfRjlHbalZhxVpZIPgMqaiz',
    database: 'railway',
    port: 23587
  };

  console.log('Testing Railway MySQL connection...');
  console.log(`Host: ${config.host}:${config.port}`);
  console.log(`Database: ${config.database}`);
  
  try {
    const connection = await mysql.createConnection(config);
    console.log('✅ Connected successfully!');
    
    // Test query
    const [result] = await connection.query('SELECT 1 + 1 AS result');
    console.log('✅ Test query successful:', result[0].result);
    
    // Show existing tables
    const [tables] = await connection.query('SHOW TABLES');
    console.log('📋 Existing tables:', tables);
    
    await connection.end();
    console.log('✅ Connection closed');
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('Full error:', error);
  }
}

testConnection();
