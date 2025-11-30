export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      payment_orders: {
        Row: {
          id: string;
          company_id: string;
          order_no: string;
          order_type: "onetime" | "recurring_first" | "recurring_renewal";
          payment_type: "subscription" | "token_package" | "lifetime";
          amount: number;
          currency: string;
          item_description: string;
          related_id: string | null;
          newebpay_status: string | null;
          newebpay_message: string | null;
          newebpay_trade_no: string | null;
          newebpay_response: Json | null;
          status:
            | "pending"
            | "processing"
            | "success"
            | "failed"
            | "cancelled"
            | "refunded";
          paid_at: string | null;
          failed_at: string | null;
          failure_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          order_no: string;
          order_type: "onetime" | "recurring_first" | "recurring_renewal";
          payment_type: "subscription" | "token_package" | "lifetime";
          amount: number;
          currency?: string;
          item_description: string;
          related_id?: string | null;
          newebpay_status?: string | null;
          newebpay_message?: string | null;
          newebpay_trade_no?: string | null;
          newebpay_response?: Json | null;
          status?:
            | "pending"
            | "processing"
            | "success"
            | "failed"
            | "cancelled"
            | "refunded";
          paid_at?: string | null;
          failed_at?: string | null;
          failure_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          order_no?: string;
          order_type?: "onetime" | "recurring_first" | "recurring_renewal";
          payment_type?: "subscription" | "token_package" | "lifetime";
          amount?: number;
          currency?: string;
          item_description?: string;
          related_id?: string | null;
          newebpay_status?: string | null;
          newebpay_message?: string | null;
          newebpay_trade_no?: string | null;
          newebpay_response?: Json | null;
          status?:
            | "pending"
            | "processing"
            | "success"
            | "failed"
            | "cancelled"
            | "refunded";
          paid_at?: string | null;
          failed_at?: string | null;
          failure_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_orders_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      recurring_mandates: {
        Row: {
          id: string;
          company_id: string;
          plan_id: string;
          mandate_no: string;
          newebpay_period_no: string | null;
          period_type: "D" | "W" | "M" | "Y";
          period_point: string | null;
          period_times: number | null;
          period_amount: number;
          total_amount: number | null;
          next_payment_date: string | null;
          periods_paid: number;
          status:
            | "pending"
            | "active"
            | "suspended"
            | "terminated"
            | "completed"
            | "failed";
          newebpay_response: Json | null;
          first_payment_order_id: string | null;
          activated_at: string | null;
          suspended_at: string | null;
          terminated_at: string | null;
          termination_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          plan_id: string;
          mandate_no: string;
          newebpay_period_no?: string | null;
          period_type: "D" | "W" | "M" | "Y";
          period_point?: string | null;
          period_times?: number | null;
          period_amount: number;
          total_amount?: number | null;
          next_payment_date?: string | null;
          periods_paid?: number;
          status?:
            | "pending"
            | "active"
            | "suspended"
            | "terminated"
            | "completed"
            | "failed";
          newebpay_response?: Json | null;
          first_payment_order_id?: string | null;
          activated_at?: string | null;
          suspended_at?: string | null;
          terminated_at?: string | null;
          termination_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          plan_id?: string;
          mandate_no?: string;
          newebpay_period_no?: string | null;
          period_type?: "D" | "W" | "M" | "Y";
          period_point?: string | null;
          period_times?: number | null;
          period_amount?: number;
          total_amount?: number | null;
          next_payment_date?: string | null;
          periods_paid?: number;
          status?:
            | "pending"
            | "active"
            | "suspended"
            | "terminated"
            | "completed"
            | "failed";
          newebpay_response?: Json | null;
          first_payment_order_id?: string | null;
          activated_at?: string | null;
          suspended_at?: string | null;
          terminated_at?: string | null;
          termination_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recurring_mandates_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recurring_mandates_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "subscription_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recurring_mandates_first_payment_order_id_fkey";
            columns: ["first_payment_order_id"];
            isOneToOne: false;
            referencedRelation: "payment_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      recurring_payments: {
        Row: {
          id: string;
          mandate_id: string;
          payment_order_id: string | null;
          period_number: number;
          amount: number;
          scheduled_date: string;
          status: "pending" | "processing" | "success" | "failed" | "skipped";
          newebpay_trade_no: string | null;
          newebpay_response: Json | null;
          paid_at: string | null;
          failed_at: string | null;
          failure_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          mandate_id: string;
          payment_order_id?: string | null;
          period_number: number;
          amount: number;
          scheduled_date: string;
          status?: "pending" | "processing" | "success" | "failed" | "skipped";
          newebpay_trade_no?: string | null;
          newebpay_response?: Json | null;
          paid_at?: string | null;
          failed_at?: string | null;
          failure_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          mandate_id?: string;
          payment_order_id?: string | null;
          period_number?: number;
          amount?: number;
          scheduled_date?: string;
          status?: "pending" | "processing" | "success" | "failed" | "skipped";
          newebpay_trade_no?: string | null;
          newebpay_response?: Json | null;
          paid_at?: string | null;
          failed_at?: string | null;
          failure_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recurring_payments_mandate_id_fkey";
            columns: ["mandate_id"];
            isOneToOne: false;
            referencedRelation: "recurring_mandates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recurring_payments_payment_order_id_fkey";
            columns: ["payment_order_id"];
            isOneToOne: false;
            referencedRelation: "payment_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      companies: {
        Row: {
          id: string;
          name: string;
          slug: string;
          owner_id: string;
          subscription_tier:
            | "free"
            | "starter"
            | "professional"
            | "business"
            | "agency";
          subscription_ends_at: string | null;
          seo_token_balance: number;
          newebpay_customer_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          owner_id: string;
          subscription_tier?:
            | "free"
            | "starter"
            | "professional"
            | "business"
            | "agency";
          subscription_ends_at?: string | null;
          seo_token_balance?: number;
          newebpay_customer_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          owner_id?: string;
          subscription_tier?:
            | "free"
            | "starter"
            | "professional"
            | "business"
            | "agency";
          subscription_ends_at?: string | null;
          seo_token_balance?: number;
          newebpay_customer_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      company_members: {
        Row: {
          id: string;
          company_id: string;
          user_id: string;
          role: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          user_id: string;
          role: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          user_id?: string;
          role?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      subscription_plans: {
        Row: {
          id: string;
          name: string;
          slug: string;
          monthly_price: number;
          yearly_price: number | null;
          yearly_discount: number | null;
          base_tokens: number;
          is_lifetime: boolean;
          lifetime_price: number | null;
          features: Json;
          limits: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          monthly_price: number;
          yearly_price?: number | null;
          yearly_discount?: number | null;
          base_tokens: number;
          is_lifetime?: boolean;
          lifetime_price?: number | null;
          features?: Json;
          limits?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          monthly_price?: number;
          yearly_price?: number | null;
          yearly_discount?: number | null;
          base_tokens?: number;
          is_lifetime?: boolean;
          lifetime_price?: number | null;
          features?: Json;
          limits?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      token_packages: {
        Row: {
          id: string;
          name: string;
          slug: string;
          tokens: number;
          price: number;
          bonus_tokens: number;
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          tokens: number;
          price: number;
          bonus_tokens?: number;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          tokens?: number;
          price?: number;
          bonus_tokens?: number;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      company_subscriptions: {
        Row: {
          id: string;
          company_id: string;
          plan_id: string;
          status: string;
          purchased_token_balance: number;
          monthly_quota_balance: number;
          monthly_token_quota: number;
          base_monthly_quota: number | null;
          purchased_count: number;
          is_lifetime: boolean;
          lifetime_discount: number;
          lifetime_free_articles_used: number;
          lifetime_free_articles_limit: number;
          current_period_start: string | null;
          current_period_end: string | null;
          trial_end: string | null;
          cancelled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          plan_id: string;
          status: string;
          purchased_token_balance?: number;
          monthly_quota_balance?: number;
          monthly_token_quota: number;
          base_monthly_quota?: number | null;
          purchased_count?: number;
          is_lifetime?: boolean;
          lifetime_discount?: number;
          lifetime_free_articles_used?: number;
          lifetime_free_articles_limit?: number;
          current_period_start?: string | null;
          current_period_end?: string | null;
          trial_end?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          plan_id?: string;
          status?: string;
          purchased_token_balance?: number;
          monthly_quota_balance?: number;
          monthly_token_quota?: number;
          base_monthly_quota?: number | null;
          purchased_count?: number;
          is_lifetime?: boolean;
          lifetime_discount?: number;
          lifetime_free_articles_used?: number;
          lifetime_free_articles_limit?: number;
          current_period_start?: string | null;
          current_period_end?: string | null;
          trial_end?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "company_subscriptions_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: true;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "subscription_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      token_balance_changes: {
        Row: {
          id: string;
          company_id: string;
          change_type: string;
          amount: number;
          balance_before: number;
          balance_after: number;
          reference_id: string | null;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          change_type: string;
          amount: number;
          balance_before: number;
          balance_after: number;
          reference_id?: string | null;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          change_type?: string;
          amount?: number;
          balance_before?: number;
          balance_after?: number;
          reference_id?: string | null;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "token_balance_changes_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      token_usage_logs: {
        Row: {
          id: string;
          company_id: string;
          article_id: string | null;
          user_id: string | null;
          model_name: string;
          model_tier: string;
          model_multiplier: number;
          input_tokens: number;
          output_tokens: number;
          total_official_tokens: number;
          charged_tokens: number;
          official_cost_usd: number;
          charged_cost_usd: number;
          usage_type:
            | "article_generation"
            | "title_generation"
            | "image_description"
            | "perplexity_analysis";
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          article_id?: string | null;
          user_id?: string | null;
          model_name: string;
          model_tier: string;
          model_multiplier: number;
          input_tokens: number;
          output_tokens: number;
          total_official_tokens: number;
          charged_tokens: number;
          official_cost_usd: number;
          charged_cost_usd: number;
          usage_type:
            | "article_generation"
            | "title_generation"
            | "image_description"
            | "perplexity_analysis";
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          article_id?: string | null;
          user_id?: string | null;
          model_name?: string;
          model_tier?: string;
          model_multiplier?: number;
          input_tokens?: number;
          output_tokens?: number;
          total_official_tokens?: number;
          charged_tokens?: number;
          official_cost_usd?: number;
          charged_cost_usd?: number;
          usage_type?:
            | "article_generation"
            | "title_generation"
            | "image_description"
            | "perplexity_analysis";
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "token_usage_logs_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "token_usage_logs_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: false;
            referencedRelation: "generated_articles";
            referencedColumns: ["id"];
          },
        ];
      };
      monthly_token_usage_stats: {
        Row: {
          id: string;
          company_id: string;
          year: number;
          month: number;
          total_articles_generated: number;
          total_tokens_used: number;
          total_cost_usd: number;
          tokens_by_model: Json;
          tokens_by_usage: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          year: number;
          month: number;
          total_articles_generated?: number;
          total_tokens_used?: number;
          total_cost_usd?: number;
          tokens_by_model?: Json;
          tokens_by_usage?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          year?: number;
          month?: number;
          total_articles_generated?: number;
          total_tokens_used?: number;
          total_cost_usd?: number;
          tokens_by_model?: Json;
          tokens_by_usage?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "monthly_token_usage_stats_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_model_pricing: {
        Row: {
          id: string;
          model_name: string;
          provider: string;
          tier: string;
          multiplier: number;
          input_price_per_1m: number;
          output_price_per_1m: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          model_name: string;
          provider: string;
          tier: string;
          multiplier: number;
          input_price_per_1m: number;
          output_price_per_1m: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          model_name?: string;
          provider?: string;
          tier?: string;
          multiplier?: number;
          input_price_per_1m?: number;
          output_price_per_1m?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      company_referral_codes: {
        Row: {
          id: string;
          company_id: string;
          referral_code: string;
          total_referrals: number;
          successful_referrals: number;
          total_rewards_tokens: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          referral_code: string;
          total_referrals?: number;
          successful_referrals?: number;
          total_rewards_tokens?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          referral_code?: string;
          total_referrals?: number;
          successful_referrals?: number;
          total_rewards_tokens?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "company_referral_codes_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: true;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      referral_codes: {
        Row: {
          id: string;
          company_id: string;
          code: string;
          total_referrals: number;
          successful_referrals: number;
          total_clicks: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          code: string;
          total_referrals?: number;
          successful_referrals?: number;
          total_clicks?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          code?: string;
          total_referrals?: number;
          successful_referrals?: number;
          total_clicks?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "referral_codes_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: true;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      referral_token_rewards: {
        Row: {
          id: string;
          referral_id: string;
          referrer_company_id: string;
          referrer_tokens: number;
          referrer_credited_at: string | null;
          referred_company_id: string;
          referred_tokens: number;
          referred_credited_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          referral_id: string;
          referrer_company_id: string;
          referrer_tokens?: number;
          referrer_credited_at?: string | null;
          referred_company_id: string;
          referred_tokens?: number;
          referred_credited_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          referral_id?: string;
          referrer_company_id?: string;
          referrer_tokens?: number;
          referrer_credited_at?: string | null;
          referred_company_id?: string;
          referred_tokens?: number;
          referred_credited_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "referral_token_rewards_referral_id_fkey";
            columns: ["referral_id"];
            isOneToOne: true;
            referencedRelation: "referrals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "referral_token_rewards_referrer_company_id_fkey";
            columns: ["referrer_company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "referral_token_rewards_referred_company_id_fkey";
            columns: ["referred_company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      referrals: {
        Row: {
          id: string;
          referrer_company_id: string;
          referred_company_id: string;
          referral_code: string;
          status: "pending" | "qualified" | "rewarded";
          registered_at: string | null;
          first_payment_at: string | null;
          first_payment_amount: number | null;
          reward_type: string | null;
          tokens_rewarded: number | null;
          total_payments: number | null;
          lifetime_value: number | null;
          total_commission_generated: number | null;
          last_payment_at: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          referrer_company_id: string;
          referred_company_id: string;
          referral_code: string;
          status?: "pending" | "qualified" | "rewarded";
          registered_at?: string | null;
          first_payment_at?: string | null;
          first_payment_amount?: number | null;
          reward_type?: string | null;
          tokens_rewarded?: number | null;
          total_payments?: number | null;
          lifetime_value?: number | null;
          total_commission_generated?: number | null;
          last_payment_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          referrer_company_id?: string;
          referred_company_id?: string;
          referral_code?: string;
          status?: "pending" | "qualified" | "rewarded";
          registered_at?: string | null;
          first_payment_at?: string | null;
          first_payment_amount?: number | null;
          reward_type?: string | null;
          tokens_rewarded?: number | null;
          total_payments?: number | null;
          lifetime_value?: number | null;
          total_commission_generated?: number | null;
          last_payment_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "referrals_referrer_company_id_fkey";
            columns: ["referrer_company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "referrals_referred_company_id_fkey";
            columns: ["referred_company_id"];
            isOneToOne: true;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      referral_rewards: {
        Row: {
          id: string;
          referral_id: string;
          company_id: string;
          reward_type: "signup" | "first_payment" | "revenue_share";
          token_amount: number | null;
          cash_amount: number | null;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          referral_id: string;
          company_id: string;
          reward_type: "signup" | "first_payment" | "revenue_share";
          token_amount?: number | null;
          cash_amount?: number | null;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          referral_id?: string;
          company_id?: string;
          reward_type?: "signup" | "first_payment" | "revenue_share";
          token_amount?: number | null;
          cash_amount?: number | null;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "referral_rewards_referral_id_fkey";
            columns: ["referral_id"];
            isOneToOne: false;
            referencedRelation: "referrals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "referral_rewards_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      resellers: {
        Row: {
          id: string;
          company_id: string;
          commission_rate: number;
          status: "active" | "suspended" | "terminated";
          total_referrals: number;
          total_revenue: number;
          total_commission: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          commission_rate?: number;
          status?: "active" | "suspended" | "terminated";
          total_referrals?: number;
          total_revenue?: number;
          total_commission?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          commission_rate?: number;
          status?: "active" | "suspended" | "terminated";
          total_referrals?: number;
          total_revenue?: number;
          total_commission?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "resellers_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: true;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      article_jobs: {
        Row: {
          id: string;
          job_id: string;
          company_id: string | null;
          website_id: string | null;
          user_id: string | null;
          keywords: string[];
          region: string;
          article_type: string;
          status: "pending" | "processing" | "completed" | "failed";
          progress: number;
          current_step: string | null;
          result_url: string | null;
          wordpress_post_id: string | null;
          error_message: string | null;
          scheduled_publish_at: string | null;
          auto_publish: boolean;
          published_at: string | null;
          featured_image_url: string | null;
          image_generation_prompt: string | null;
          image_alt_text: string | null;
          metadata: Json | null;
          free_quota_deducted: boolean;
          created_at: string;
          started_at: string | null;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          job_id?: string;
          company_id?: string | null;
          website_id?: string | null;
          user_id?: string | null;
          keywords: string[];
          region?: string;
          article_type?: string;
          status?: "pending" | "processing" | "completed" | "failed";
          progress?: number;
          current_step?: string | null;
          result_url?: string | null;
          wordpress_post_id?: string | null;
          error_message?: string | null;
          scheduled_publish_at?: string | null;
          auto_publish?: boolean;
          published_at?: string | null;
          featured_image_url?: string | null;
          image_generation_prompt?: string | null;
          image_alt_text?: string | null;
          metadata?: Json | null;
          free_quota_deducted?: boolean;
          created_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          job_id?: string;
          company_id?: string | null;
          website_id?: string | null;
          user_id?: string | null;
          keywords?: string[];
          region?: string;
          article_type?: string;
          status?: "pending" | "processing" | "completed" | "failed";
          progress?: number;
          current_step?: string | null;
          result_url?: string | null;
          wordpress_post_id?: string | null;
          error_message?: string | null;
          scheduled_publish_at?: string | null;
          auto_publish?: boolean;
          published_at?: string | null;
          featured_image_url?: string | null;
          image_generation_prompt?: string | null;
          image_alt_text?: string | null;
          metadata?: Json | null;
          free_quota_deducted?: boolean;
          created_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "article_jobs_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "article_jobs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      commissions: {
        Row: {
          id: string;
          reseller_id: string;
          order_type: "subscription" | "token_package" | "lifetime";
          order_id: string;
          customer_company_id: string;
          order_amount: number;
          commission_rate: number;
          commission_amount: number;
          status: "pending" | "approved" | "paid" | "rejected";
          paid_at: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          reseller_id: string;
          order_type: "subscription" | "token_package" | "lifetime";
          order_id: string;
          customer_company_id: string;
          order_amount: number;
          commission_rate: number;
          commission_amount: number;
          status?: "pending" | "approved" | "paid" | "rejected";
          paid_at?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          reseller_id?: string;
          order_type?: "subscription" | "token_package" | "lifetime";
          order_id?: string;
          customer_company_id?: string;
          order_amount?: number;
          commission_rate?: number;
          commission_amount?: number;
          status?: "pending" | "approved" | "paid" | "rejected";
          paid_at?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "commissions_reseller_id_fkey";
            columns: ["reseller_id"];
            isOneToOne: false;
            referencedRelation: "resellers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commissions_customer_company_id_fkey";
            columns: ["customer_company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      website_configs: {
        Row: {
          id: string;
          company_id: string | null;
          website_name: string;
          wordpress_url: string;
          wordpress_oauth_client_id: string | null;
          wordpress_oauth_client_secret: string | null;
          wordpress_access_token: string | null;
          wordpress_refresh_token: string | null;
          wordpress_token_expires_at: string | null;
          brand_voice: Json | null;
          language: string | null;
          api_config: Json | null;
          is_active: boolean | null;
          created_at: string | null;
          updated_at: string | null;
          created_by: string | null;
          wp_username: string | null;
          wp_app_password: string | null;
          wp_enabled: boolean | null;
        };
        Insert: {
          id?: string;
          company_id?: string | null;
          website_name: string;
          wordpress_url: string;
          wordpress_oauth_client_id?: string | null;
          wordpress_oauth_client_secret?: string | null;
          wordpress_access_token?: string | null;
          wordpress_refresh_token?: string | null;
          wordpress_token_expires_at?: string | null;
          brand_voice?: Json | null;
          language?: string | null;
          api_config?: Json | null;
          is_active?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
          created_by?: string | null;
          wp_username?: string | null;
          wp_app_password?: string | null;
          wp_enabled?: boolean | null;
        };
        Update: {
          id?: string;
          company_id?: string | null;
          website_name?: string;
          wordpress_url?: string;
          wordpress_oauth_client_id?: string | null;
          wordpress_oauth_client_secret?: string | null;
          wordpress_access_token?: string | null;
          wordpress_refresh_token?: string | null;
          wordpress_token_expires_at?: string | null;
          brand_voice?: Json | null;
          language?: string | null;
          api_config?: Json | null;
          is_active?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
          created_by?: string | null;
          wp_username?: string | null;
          wp_app_password?: string | null;
          wp_enabled?: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: "website_configs_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type Inserts<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type Updates<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
