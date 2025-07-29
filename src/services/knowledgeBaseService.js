const { Client } = require('pg');

class KnowledgeBaseService {
  async createConnection() {
    return new Client({
      connectionString: process.env.DATABASE_URL
    });
  }

  async searchFAQs(query, limit = 5) {
    const client = await this.createConnection();
    
    try {
      await client.connect();
      
      // Simple keyword search across title, content, and keywords
      const searchQuery = `
        SELECT id, title, content, keywords, category, subcategory, solution_steps
        FROM knowledge_base 
        WHERE is_active = true 
        AND (
          title ILIKE $1 
          OR content ILIKE $1 
          OR keywords && ARRAY[$2]
          OR $2 = ANY(keywords)
        )
        ORDER BY 
          CASE 
            WHEN title ILIKE $1 THEN 1
            WHEN $2 = ANY(keywords) THEN 2
            WHEN content ILIKE $1 THEN 3
            ELSE 4
          END
        LIMIT $3
      `;
      
      const searchTerm = `%${query.toLowerCase()}%`;
      const keywordTerm = query.toLowerCase();
      
      const result = await client.query(searchQuery, [searchTerm, keywordTerm, limit]);
      
      return result.rows.map(row => ({
        id: row.id,
        title: row.title,
        content: row.content,
        keywords: row.keywords,
        category: row.category,
        subcategory: row.subcategory,
        solutionSteps: row.solution_steps,
        relevanceScore: this.calculateRelevance(query, row)
      }));
      
    } finally {
      await client.end();
    }
  }

  calculateRelevance(query, row) {
    const queryLower = query.toLowerCase();
    let score = 0;
    
    // Title match gets highest score
    if (row.title.toLowerCase().includes(queryLower)) score += 10;
    
    // Keyword exact match
    if (row.keywords && row.keywords.some(k => k.toLowerCase() === queryLower)) score += 8;
    
    // Keyword partial match
    if (row.keywords && row.keywords.some(k => k.toLowerCase().includes(queryLower))) score += 5;
    
    // Content match
    if (row.content.toLowerCase().includes(queryLower)) score += 3;
    
    return score;
  }

  async getAllCategories() {
    const client = await this.createConnection();
    
    try {
      await client.connect();
      
      const result = await client.query(`
        SELECT DISTINCT category, COUNT(*) as count
        FROM knowledge_base 
        WHERE is_active = true 
        GROUP BY category 
        ORDER BY category
      `);
      
      return result.rows;
      
    } finally {
      await client.end();
    }
  }
}

module.exports = new KnowledgeBaseService();
