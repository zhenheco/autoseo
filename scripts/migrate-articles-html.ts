import { marked } from 'marked'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function migrateArticles() {
  console.log('Starting article HTML migration...')

  try {
    // Fetch all articles that have markdown content but no HTML content
    const { data: articles, error } = await supabase
      .from('generated_articles')
      .select('id, title, markdown_content, html_content')
      .is('html_content', null)
      .not('markdown_content', 'is', null)

    if (error) {
      console.error('Error fetching articles:', error)
      return
    }

    if (!articles || articles.length === 0) {
      console.log('No articles need migration')
      return
    }

    console.log(`Found ${articles.length} articles to migrate`)

    // Convert markdown to HTML for each article
    for (const article of articles) {
      try {
        console.log(`Migrating article: ${article.id} - ${article.title}`)

        // Convert markdown to HTML
        const htmlContent = marked(article.markdown_content || '')

        // Update the article with HTML content
        const { error: updateError } = await supabase
          .from('generated_articles')
          .update({ html_content: htmlContent })
          .eq('id', article.id)

        if (updateError) {
          console.error(`Error updating article ${article.id}:`, updateError)
        } else {
          console.log(`✓ Successfully migrated article ${article.id}`)
        }
      } catch (error) {
        console.error(`Error processing article ${article.id}:`, error)
      }
    }

    console.log('Migration completed!')

  } catch (error) {
    console.error('Migration failed:', error)
  }
}

// Run the migration
migrateArticles()