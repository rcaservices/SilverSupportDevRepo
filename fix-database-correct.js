const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
  console.log('🔧 Setting up database with correct Docker credentials...');
  
  // Connect to the actual running Docker container
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'ai_support_dev',
    user: 'postgres',
    password: 'password'
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL');

    // Read and execute schema
    const schemaPath = path.join(__dirname, 'src/database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    await client.query(schema);
    console.log('✅ Database schema created successfully');

    // Import FAQs
    console.log('📚 Importing FAQ data...');
    
    const faqDir = path.join(__dirname, 'knowledge-base/faqs');
    const files = fs.readdirSync(faqDir).filter(file => file.endsWith('.json'));
    
    for (const file of files) {
      const filePath = path.join(faqDir, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      for (const faq of data.faqs) {
        await client.query(`
          INSERT INTO knowledge_base (title, content, keywords, category, subcategory, solution_steps)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT DO NOTHING
        `, [
          faq.title,
          faq.content,
          faq.keywords,
          faq.category,
          faq.subcategory,
          JSON.stringify(faq.solution_steps)
        ]);
      }
      
      console.log(`✅ Imported FAQs from ${file}`);
    }
    
    console.log('🎉 Setup completed successfully');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setupDatabase();
