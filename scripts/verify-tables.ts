import pkg from 'pg';
const { Client } = pkg;

async function verifyTables() {
  const client = new Client({ connectionString: process.env.SUPABASE_DB_URL });
  
  try {
    await client.connect();
    
    // 查詢新創建的表
    const result = await client.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('generated_articles', 'article_recommendations')
      ORDER BY table_name;
    `);
    
    console.log('✅ 資料表驗證：');
    result.rows.forEach(row => {
      console.log(`  - ${row.table_name} (${row.table_type})`);
    });
    
    // 查詢 generated_articles 的欄位
    const columns = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'generated_articles'
      ORDER BY ordinal_position;
    `);
    
    console.log('\n📊 generated_articles 欄位:', columns.rows.length);
    
    // 查詢函數
    const functions = await client.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
        AND routine_name IN ('calculate_article_similarity', 'generate_article_recommendations', 'update_generated_articles_updated_at');
    `);
    
    console.log('\n🔧 函數:', functions.rows.length);
    functions.rows.forEach(row => {
      console.log(`  - ${row.routine_name}()`);
    });
    
  } finally {
    await client.end();
  }
}

verifyTables().catch(console.error);
