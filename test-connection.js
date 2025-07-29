const { Client } = require('pg');

async function testConnection() {
  console.log('Testing connection...');
  
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'postgres', // Try connecting to default database first
    user: 'postgres',
    password: 'password'
  });

  try {
    await client.connect();
    console.log('✅ Connected successfully');
    
    const result = await client.query('SELECT current_user, current_database(), version()');
    console.log('Current user:', result.rows[0].current_user);
    console.log('Current database:', result.rows[0].current_database);
    console.log('Version:', result.rows[0].version.split(' ')[0]);
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('Error code:', error.code);
  } finally {
    await client.end();
  }
}

testConnection();
