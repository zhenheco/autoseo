export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string
          name: string
          slug: string
          owner_id: string | null
          subscription_tier: 'free' | 'basic' | 'pro' | 'enterprise'
          newebpay_customer_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          owner_id?: string | null
          subscription_tier?: 'free' | 'basic' | 'pro' | 'enterprise'
          newebpay_customer_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          owner_id?: string | null
          subscription_tier?: 'free' | 'basic' | 'pro' | 'enterprise'
          newebpay_customer_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      company_members: {
        Row: {
          id: string
          company_id: string
          user_id: string
          role: 'owner' | 'admin' | 'editor' | 'writer' | 'viewer'
          invited_at: string
          joined_at: string | null
          invited_by: string | null
          status: 'pending' | 'active' | 'suspended'
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          user_id: string
          role: 'owner' | 'admin' | 'editor' | 'writer' | 'viewer'
          invited_at?: string
          joined_at?: string | null
          invited_by?: string | null
          status?: 'pending' | 'active' | 'suspended'
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          user_id?: string
          role?: 'owner' | 'admin' | 'editor' | 'writer' | 'viewer'
          invited_at?: string
          joined_at?: string | null
          invited_by?: string | null
          status?: 'pending' | 'active' | 'suspended'
          created_at?: string
        }
      }
      website_configs: {
        Row: {
          id: string
          company_id: string
          website_name: string
          wordpress_url: string
          wordpress_oauth_client_id: string | null
          wordpress_oauth_client_secret: string | null
          wordpress_access_token: string | null
          wordpress_refresh_token: string | null
          wordpress_token_expires_at: string | null
          brand_voice: Json
          language: string
          api_config: Json
          n8n_webhook_url: string | null
          is_active: boolean
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          company_id: string
          website_name: string
          wordpress_url: string
          wordpress_oauth_client_id?: string | null
          wordpress_oauth_client_secret?: string | null
          wordpress_access_token?: string | null
          wordpress_refresh_token?: string | null
          wordpress_token_expires_at?: string | null
          brand_voice?: Json
          language?: string
          api_config?: Json
          n8n_webhook_url?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          company_id?: string
          website_name?: string
          wordpress_url?: string
          wordpress_oauth_client_id?: string | null
          wordpress_oauth_client_secret?: string | null
          wordpress_access_token?: string | null
          wordpress_refresh_token?: string | null
          wordpress_token_expires_at?: string | null
          brand_voice?: Json
          language?: string
          api_config?: Json
          n8n_webhook_url?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
      }
      article_jobs: {
        Row: {
          id: string
          job_id: string
          company_id: string
          website_id: string
          user_id: string | null
          keywords: string[]
          region: string
          article_type: string
          status: 'pending' | 'processing' | 'completed' | 'failed'
          progress: number
          current_step: string | null
          result_url: string | null
          wordpress_post_id: string | null
          error_message: string | null
          scheduled_publish_at: string | null
          auto_publish: boolean
          published_at: string | null
          featured_image_url: string | null
          image_generation_prompt: string | null
          image_alt_text: string | null
          metadata: Json | null
          created_at: string
          started_at: string | null
          completed_at: string | null
        }
        Insert: {
          id?: string
          job_id: string
          company_id: string
          website_id: string
          user_id?: string | null
          keywords: string[]
          region?: string
          article_type?: string
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          progress?: number
          current_step?: string | null
          result_url?: string | null
          wordpress_post_id?: string | null
          error_message?: string | null
          scheduled_publish_at?: string | null
          auto_publish?: boolean
          published_at?: string | null
          featured_image_url?: string | null
          image_generation_prompt?: string | null
          image_alt_text?: string | null
          metadata?: Json | null
          created_at?: string
          started_at?: string | null
          completed_at?: string | null
        }
        Update: {
          id?: string
          job_id?: string
          company_id?: string
          website_id?: string
          user_id?: string | null
          keywords?: string[]
          region?: string
          article_type?: string
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          progress?: number
          current_step?: string | null
          result_url?: string | null
          wordpress_post_id?: string | null
          error_message?: string | null
          scheduled_publish_at?: string | null
          auto_publish?: boolean
          published_at?: string | null
          featured_image_url?: string | null
          image_generation_prompt?: string | null
          image_alt_text?: string | null
          metadata?: Json | null
          created_at?: string
          started_at?: string | null
          completed_at?: string | null
        }
      }
      subscription_plans: {
        Row: {
          id: string
          name: string
          display_name: string
          price_twd: number
          billing_period: 'monthly' | 'yearly'
          article_limit: number | null
          website_limit: number | null
          team_member_limit: number | null
          features: Json
          can_use_own_api_keys: boolean
          priority_processing: boolean
          is_active: boolean
          sort_order: number | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          display_name: string
          price_twd: number
          billing_period?: 'monthly' | 'yearly'
          article_limit?: number | null
          website_limit?: number | null
          team_member_limit?: number | null
          features?: Json
          can_use_own_api_keys?: boolean
          priority_processing?: boolean
          is_active?: boolean
          sort_order?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          display_name?: string
          price_twd?: number
          billing_period?: 'monthly' | 'yearly'
          article_limit?: number | null
          website_limit?: number | null
          team_member_limit?: number | null
          features?: Json
          can_use_own_api_keys?: boolean
          priority_processing?: boolean
          is_active?: boolean
          sort_order?: number | null
          created_at?: string
        }
      }
      subscriptions: {
        Row: {
          id: string
          company_id: string
          newebpay_order_no: string | null
          plan_name: 'free' | 'basic' | 'pro' | 'enterprise'
          status: 'active' | 'cancelled' | 'expired' | 'pending'
          current_period_start: string | null
          current_period_end: string | null
          monthly_article_limit: number | null
          articles_used_this_month: number
          auto_renew: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          newebpay_order_no?: string | null
          plan_name: 'free' | 'basic' | 'pro' | 'enterprise'
          status?: 'active' | 'cancelled' | 'expired' | 'pending'
          current_period_start?: string | null
          current_period_end?: string | null
          monthly_article_limit?: number | null
          articles_used_this_month?: number
          auto_renew?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          newebpay_order_no?: string | null
          plan_name?: 'free' | 'basic' | 'pro' | 'enterprise'
          status?: 'active' | 'cancelled' | 'expired' | 'pending'
          current_period_start?: string | null
          current_period_end?: string | null
          monthly_article_limit?: number | null
          articles_used_this_month?: number
          auto_renew?: boolean
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_permission: {
        Args: {
          check_user_id: string
          check_company_id: string
          required_permission: string
        }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}
