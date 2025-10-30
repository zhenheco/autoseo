export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      company_subscriptions: {
        Row: {
          cancelled_at: string | null
          company_id: string
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          is_lifetime: boolean | null
          lifetime_discount: number | null
          monthly_quota_balance: number
          monthly_token_quota: number
          plan_id: string
          purchased_token_balance: number
          status: string
          token_balance: number
          trial_end: string | null
          updated_at: string | null
        }
        Insert: {
          cancelled_at?: string | null
          company_id: string
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          is_lifetime?: boolean | null
          lifetime_discount?: number | null
          monthly_quota_balance?: number
          monthly_token_quota: number
          plan_id: string
          purchased_token_balance?: number
          status: string
          token_balance?: number
          trial_end?: string | null
          updated_at?: string | null
        }
        Update: {
          cancelled_at?: string | null
          company_id?: string
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          is_lifetime?: boolean | null
          lifetime_discount?: number | null
          monthly_quota_balance?: number
          monthly_token_quota?: number
          plan_id?: string
          purchased_token_balance?: number
          status?: string
          token_balance?: number
          trial_end?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          base_tokens: number
          created_at: string | null
          features: Json
          id: string
          is_lifetime: boolean | null
          lifetime_price: number | null
          limits: Json
          monthly_price: number
          name: string
          slug: string
          updated_at: string | null
          yearly_discount: number | null
          yearly_price: number | null
        }
        Insert: {
          base_tokens: number
          created_at?: string | null
          features?: Json
          id?: string
          is_lifetime?: boolean | null
          lifetime_price?: number | null
          limits?: Json
          monthly_price: number
          name: string
          slug: string
          updated_at?: string | null
          yearly_discount?: number | null
          yearly_price?: number | null
        }
        Update: {
          base_tokens?: number
          created_at?: string | null
          features?: Json
          id?: string
          is_lifetime?: boolean | null
          lifetime_price?: number | null
          limits?: Json
          monthly_price?: number
          name?: string
          slug?: string
          updated_at?: string | null
          yearly_discount?: number | null
          yearly_price?: number | null
        }
        Relationships: []
      }
      token_packages: {
        Row: {
          bonus_tokens: number | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          price: number
          slug: string
          tokens: number
          updated_at: string | null
        }
        Insert: {
          bonus_tokens?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          price: number
          slug: string
          tokens: number
          updated_at?: string | null
        }
        Update: {
          bonus_tokens?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number
          slug?: string
          tokens?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      token_usage_logs: {
        Row: {
          article_id: string | null
          charged_cost_usd: number
          charged_tokens: number
          company_id: string
          created_at: string | null
          id: string
          input_tokens: number
          metadata: Json | null
          model_multiplier: number
          model_name: string
          model_tier: string
          official_cost_usd: number
          output_tokens: number
          total_official_tokens: number
          usage_type: string
          user_id: string | null
        }
        Insert: {
          article_id?: string | null
          charged_cost_usd: number
          charged_tokens: number
          company_id: string
          created_at?: string | null
          id?: string
          input_tokens: number
          metadata?: Json | null
          model_multiplier: number
          model_name: string
          model_tier: string
          official_cost_usd: number
          output_tokens: number
          total_official_tokens: number
          usage_type: string
          user_id?: string | null
        }
        Update: {
          article_id?: string | null
          charged_cost_usd?: number
          charged_tokens?: number
          company_id?: string
          created_at?: string | null
          id?: string
          input_tokens?: number
          metadata?: Json | null
          model_multiplier?: number
          model_name?: string
          model_tier?: string
          official_cost_usd?: number
          output_tokens?: number
          total_official_tokens?: number
          usage_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "token_usage_logs_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "generated_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "token_usage_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_model_pricing: {
        Row: {
          created_at: string | null
          id: string
          input_price_per_1m: number
          is_active: boolean | null
          model_name: string
          multiplier: number
          output_price_per_1m: number
          provider: string
          tier: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          input_price_per_1m: number
          is_active?: boolean | null
          model_name: string
          multiplier?: number
          output_price_per_1m: number
          provider: string
          tier: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          input_price_per_1m?: number
          is_active?: boolean | null
          model_name?: string
          multiplier?: number
          output_price_per_1m?: number
          provider?: string
          tier?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      [key: string]: unknown
    }
    Views: {
      [key: string]: unknown
    }
    Functions: {
      [key: string]: unknown
    }
    Enums: {
      [key: string]: unknown
    }
    CompositeTypes: {
      [key: string]: unknown
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<T extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])> =
  (DefaultSchema["Tables"] & DefaultSchema["Views"])[T] extends { Row: infer R } ? R : never

export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T] extends { Insert: infer I } ? I : never

export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T] extends { Update: infer U } ? U : never

export type Enums<T extends keyof DefaultSchema["Enums"]> = DefaultSchema["Enums"][T]
