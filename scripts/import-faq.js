const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

async function importFAQs() {
  console.log('📚 Importing FAQ data...');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    
    const faqDir = path.join(__dirname, '../knowledge-base/faqs');
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
    
    console.log('🎉 FAQ import completed successfully');
    
  } catch (error) {
    console.error('❌ FAQ import failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

importFAQs();
