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
      audit_reports: {
        Row: {
          id: string;
          company_id: string | null;
          website_id: string | null;
          url: string;
          scope: "single-page" | "sitemap" | "crawl";
          health_score: number;
          pages_scanned: number;
          raw_payload: Json;
          source: "cli" | "dashboard" | "cron" | "lead-gen";
          scanned_at: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id?: string | null;
          website_id?: string | null;
          url: string;
          scope: "single-page" | "sitemap" | "crawl";
          health_score: number;
          pages_scanned?: number;
          raw_payload: Json;
          source: "cli" | "dashboard" | "cron" | "lead-gen";
          scanned_at: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string | null;
          website_id?: string | null;
          url?: string;
          scope?: "single-page" | "sitemap" | "crawl";
          health_score?: number;
          pages_scanned?: number;
          raw_payload?: Json;
          source?: "cli" | "dashboard" | "cron" | "lead-gen";
          scanned_at?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_reports_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_reports_website_id_fkey";
            columns: ["website_id"];
            isOneToOne: false;
            referencedRelation: "website_configs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_reports_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_issues: {
        Row: {
          id: string;
          report_id: string;
          rule_id: string;
          severity: "critical" | "warning" | "info";
          risk_level: "low" | "medium" | "high";
          page: string;
          selector: string | null;
          current: string;
          suggested: string | null;
          source: "html-scan" | "cwv" | "gsc-cross" | "a11y" | "security";
          estimated_impact: "high" | "medium" | "low";
          status:
            | "open"
            | "auto-applied"
            | "pending-review"
            | "manual"
            | "resolved";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          report_id: string;
          rule_id: string;
          severity: "critical" | "warning" | "info";
          risk_level: "low" | "medium" | "high";
          page: string;
          selector?: string | null;
          current: string;
          suggested?: string | null;
          source: "html-scan" | "cwv" | "gsc-cross" | "a11y" | "security";
          estimated_impact: "high" | "medium" | "low";
          status?:
            | "open"
            | "auto-applied"
            | "pending-review"
            | "manual"
            | "resolved";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          report_id?: string;
          rule_id?: string;
          severity?: "critical" | "warning" | "info";
          risk_level?: "low" | "medium" | "high";
          page?: string;
          selector?: string | null;
          current?: string;
          suggested?: string | null;
          source?: "html-scan" | "cwv" | "gsc-cross" | "a11y" | "security";
          estimated_impact?: "high" | "medium" | "low";
          status?:
            | "open"
            | "auto-applied"
            | "pending-review"
            | "manual"
            | "resolved";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_issues_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "audit_reports";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_fix_log: {
        Row: {
          id: string;
          issue_id: string;
          applied_by: string;
          applied_at: string;
          route:
            | "article-generator"
            | "shopline-editor"
            | "edge-worker"
            | "manual";
          before: string | null;
          after: string | null;
          result: "success" | "failed";
          error_message: string | null;
        };
        Insert: {
          id?: string;
          issue_id: string;
          applied_by: string;
          applied_at?: string;
          route:
            | "article-generator"
            | "shopline-editor"
            | "edge-worker"
            | "manual";
          before?: string | null;
          after?: string | null;
          result: "success" | "failed";
          error_message?: string | null;
        };
        Update: {
          id?: string;
          issue_id?: string;
          applied_by?: string;
          applied_at?: string;
          route?:
            | "article-generator"
            | "shopline-editor"
            | "edge-worker"
            | "manual";
          before?: string | null;
          after?: string | null;
          result?: "success" | "failed";
          error_message?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_fix_log_issue_id_fkey";
            columns: ["issue_id"];
            isOneToOne: false;
            referencedRelation: "audit_issues";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_lead_inquiries: {
        Row: {
          id: string;
          url: string;
          email: string | null;
          ip_hash: string;
          scanned_at: string;
          converted_to_company_id: string | null;
          nurture_stage: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          url: string;
          email?: string | null;
          ip_hash: string;
          scanned_at?: string;
          converted_to_company_id?: string | null;
          nurture_stage?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          url?: string;
          email?: string | null;
          ip_hash?: string;
          scanned_at?: string;
          converted_to_company_id?: string | null;
          nurture_stage?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_lead_inquiries_converted_to_company_id_fkey";
            columns: ["converted_to_company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      brands: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          voice_tone: string | null;
          target_audience: Json | null;
          value_props: string[] | null;
          brand_guidelines: string | null;
          logo_url: string | null;
          primary_color: string | null;
          secondary_color: string | null;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          voice_tone?: string | null;
          target_audience?: Json | null;
          value_props?: string[] | null;
          brand_guidelines?: string | null;
          logo_url?: string | null;
          primary_color?: string | null;
          secondary_color?: string | null;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          voice_tone?: string | null;
          target_audience?: Json | null;
          value_props?: string[] | null;
          brand_guidelines?: string | null;
          logo_url?: string | null;
          primary_color?: string | null;
          secondary_color?: string | null;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brands_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      brand_keywords: {
        Row: {
          brand_id: string;
          keyword: string;
          priority: number;
          created_at: string;
        };
        Insert: {
          brand_id: string;
          keyword: string;
          priority?: number;
          created_at?: string;
        };
        Update: {
          brand_id?: string;
          keyword?: string;
          priority?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brand_keywords_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
        ];
      };
      brand_performance_memory: {
        Row: {
          brand_id: string;
          metric_key: string;
          metric_value: Json;
          updated_at: string;
        };
        Insert: {
          brand_id: string;
          metric_key: string;
          metric_value: Json;
          updated_at?: string;
        };
        Update: {
          brand_id?: string;
          metric_key?: string;
          metric_value?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brand_performance_memory_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
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
          subscription_tier: "free" | "starter" | "pro" | "business" | "agency";
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
            | "pro"
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
            | "pro"
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
      shopline_install_invitations: {
        Row: {
          token: string;
          company_id: string;
          expected_shop_handle: string | null;
          note: string | null;
          expires_at: string;
          last_redeemed_at: string | null;
          redeem_count: number;
          revoked_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          token?: string;
          company_id: string;
          expected_shop_handle?: string | null;
          note?: string | null;
          expires_at: string;
          last_redeemed_at?: string | null;
          redeem_count?: number;
          revoked_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          token?: string;
          company_id?: string;
          expected_shop_handle?: string | null;
          note?: string | null;
          expires_at?: string;
          last_redeemed_at?: string | null;
          redeem_count?: number;
          revoked_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shopline_install_invitations_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shopline_install_invitations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      shopline_seo_audit_log: {
        Row: {
          id: string;
          company_id: string;
          website_id: string;
          entity_type:
            | "product"
            | "collection"
            | "shop"
            | "image"
            | "category_assignment"
            | "redirect"
            | "collection_hierarchy";
          entity_id: string;
          field: string;
          before_value: string | null;
          after_value: string | null;
          source: "ui" | "cli" | "ai";
          model: string | null;
          user_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          website_id: string;
          entity_type:
            | "product"
            | "collection"
            | "shop"
            | "image"
            | "category_assignment"
            | "redirect"
            | "collection_hierarchy";
          entity_id: string;
          field: string;
          before_value?: string | null;
          after_value?: string | null;
          source: "ui" | "cli" | "ai";
          model?: string | null;
          user_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          website_id?: string;
          entity_type?:
            | "product"
            | "collection"
            | "shop"
            | "image"
            | "category_assignment"
            | "redirect"
            | "collection_hierarchy";
          entity_id?: string;
          field?: string;
          before_value?: string | null;
          after_value?: string | null;
          source?: "ui" | "cli" | "ai";
          model?: string | null;
          user_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shopline_seo_audit_log_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shopline_seo_audit_log_website_id_fkey";
            columns: ["website_id"];
            isOneToOne: false;
            referencedRelation: "website_configs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shopline_seo_audit_log_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      shopline_collection_hierarchy: {
        Row: {
          id: string;
          website_id: string;
          collection_id: string;
          parent_collection_id: string | null;
          display_order: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          website_id: string;
          collection_id: string;
          parent_collection_id?: string | null;
          display_order?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          website_id?: string;
          collection_id?: string;
          parent_collection_id?: string | null;
          display_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shopline_collection_hierarchy_website_id_fkey";
            columns: ["website_id"];
            isOneToOne: false;
            referencedRelation: "website_configs";
            referencedColumns: ["id"];
          },
        ];
      };
      shopline_shop_meta: {
        Row: {
          id: string;
          website_id: string;
          seo_title_template: string | null;
          default_description: string | null;
          robots_index_products: boolean;
          robots_index_collections: boolean;
          sitemap_enabled: boolean;
          default_og_image: string | null;
          hreflang_map: Json | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          website_id: string;
          seo_title_template?: string | null;
          default_description?: string | null;
          robots_index_products?: boolean;
          robots_index_collections?: boolean;
          sitemap_enabled?: boolean;
          default_og_image?: string | null;
          hreflang_map?: Json | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          website_id?: string;
          seo_title_template?: string | null;
          default_description?: string | null;
          robots_index_products?: boolean;
          robots_index_collections?: boolean;
          sitemap_enabled?: boolean;
          default_og_image?: string | null;
          hreflang_map?: Json | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shopline_shop_meta_website_id_fkey";
            columns: ["website_id"];
            isOneToOne: true;
            referencedRelation: "website_configs";
            referencedColumns: ["id"];
          },
        ];
      };
      shopline_redirects: {
        Row: {
          id: string;
          website_id: string;
          entity_type: "product" | "collection" | "page";
          entity_id: string | null;
          handle_from: string;
          handle_to: string;
          created_at: string;
          last_hit_at: string | null;
          hit_count: number;
        };
        Insert: {
          id?: string;
          website_id: string;
          entity_type: "product" | "collection" | "page";
          entity_id?: string | null;
          handle_from: string;
          handle_to: string;
          created_at?: string;
          last_hit_at?: string | null;
          hit_count?: number;
        };
        Update: {
          id?: string;
          website_id?: string;
          entity_type?: "product" | "collection" | "page";
          entity_id?: string | null;
          handle_from?: string;
          handle_to?: string;
          created_at?: string;
          last_hit_at?: string | null;
          hit_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "shopline_redirects_website_id_fkey";
            columns: ["website_id"];
            isOneToOne: false;
            referencedRelation: "website_configs";
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
          articles_per_month: number;
          yearly_bonus_months: number;
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
          base_tokens?: number;
          is_lifetime?: boolean;
          lifetime_price?: number | null;
          features?: Json;
          limits?: Json;
          articles_per_month?: number;
          yearly_bonus_months?: number;
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
          articles_per_month?: number;
          yearly_bonus_months?: number;
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
      article_packages: {
        Row: {
          id: string;
          slug: string;
          name: string;
          price: number;
          articles: number;
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          price: number;
          articles: number;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          price?: number;
          articles?: number;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      purchased_article_credits: {
        Row: {
          id: string;
          company_id: string;
          source_type: "package" | "bonus" | "promo";
          source_id: string | null;
          original_articles: number;
          remaining_articles: number;
          price_per_article: number | null;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          source_type: "package" | "bonus" | "promo";
          source_id?: string | null;
          original_articles: number;
          remaining_articles: number;
          price_per_article?: number | null;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          source_type?: "package" | "bonus" | "promo";
          source_id?: string | null;
          original_articles?: number;
          remaining_articles?: number;
          price_per_article?: number | null;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "purchased_article_credits_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      article_usage_logs: {
        Row: {
          id: string;
          company_id: string;
          article_job_id: string | null;
          deducted_from: "subscription" | "purchased";
          credit_id: string | null;
          article_title: string | null;
          article_keywords: string[] | null;
          deducted_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          article_job_id?: string | null;
          deducted_from: "subscription" | "purchased";
          credit_id?: string | null;
          article_title?: string | null;
          article_keywords?: string[] | null;
          deducted_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          article_job_id?: string | null;
          deducted_from?: "subscription" | "purchased";
          credit_id?: string | null;
          article_title?: string | null;
          article_keywords?: string[] | null;
          deducted_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "article_usage_logs_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "article_usage_logs_article_job_id_fkey";
            columns: ["article_job_id"];
            isOneToOne: false;
            referencedRelation: "article_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "article_usage_logs_credit_id_fkey";
            columns: ["credit_id"];
            isOneToOne: false;
            referencedRelation: "purchased_article_credits";
            referencedColumns: ["id"];
          },
        ];
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
          subscription_articles_remaining: number | null;
          purchased_articles_remaining: number | null;
          articles_per_month: number | null;
          billing_cycle: "monthly" | "yearly" | null;
          last_quota_reset_at: string | null;
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
          subscription_articles_remaining?: number | null;
          purchased_articles_remaining?: number | null;
          articles_per_month?: number | null;
          billing_cycle?: "monthly" | "yearly" | null;
          last_quota_reset_at?: string | null;
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
          subscription_articles_remaining?: number | null;
          purchased_articles_remaining?: number | null;
          articles_per_month?: number | null;
          billing_cycle?: "monthly" | "yearly" | null;
          last_quota_reset_at?: string | null;
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
      resellers: {
        Row: {
          id: string;
          company_id: string;
          commission_rate: number;
          status: "active" | "suspended" | "terminated";
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
          status:
            | "pending"
            | "processing"
            | "completed"
            | "failed"
            | "cancelled"
            | "scheduled"
            | "schedule_failed"
            | "published";
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
          sync_target_ids: Json | null;
          audit_issue_id: string | null;
          source_type: string | null;
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
          status?:
            | "pending"
            | "processing"
            | "completed"
            | "failed"
            | "cancelled"
            | "scheduled"
            | "schedule_failed"
            | "published";
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
          sync_target_ids?: Json | null;
          audit_issue_id?: string | null;
          source_type?: string | null;
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
          status?:
            | "pending"
            | "processing"
            | "completed"
            | "failed"
            | "cancelled"
            | "scheduled"
            | "schedule_failed"
            | "published";
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
          sync_target_ids?: Json | null;
          audit_issue_id?: string | null;
          source_type?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "article_jobs_audit_issue_id_fkey";
            columns: ["audit_issue_id"];
            isOneToOne: false;
            referencedRelation: "audit_issues";
            referencedColumns: ["id"];
          },
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
      generated_articles: {
        Row: {
          id: string;
          article_job_id: string | null;
          company_id: string | null;
          website_id: string | null;
          brand_id: string | null;
          user_id: string | null;
          title: string;
          slug: string;
          markdown_content: string;
          html_content: string;
          excerpt: string | null;
          seo_title: string | null;
          seo_description: string | null;
          focus_keyword: string | null;
          keywords: string[] | null;
          og_title: string | null;
          og_description: string | null;
          og_image: string | null;
          twitter_card_type: string | null;
          twitter_title: string | null;
          twitter_description: string | null;
          twitter_image: string | null;
          categories: string[] | null;
          tags: string[] | null;
          word_count: number | null;
          reading_time: number | null;
          paragraph_count: number | null;
          sentence_count: number | null;
          flesch_reading_ease: number | null;
          flesch_kincaid_grade: number | null;
          gunning_fog_index: number | null;
          keyword_density: number | null;
          keyword_usage_count: number | null;
          internal_links: Json | null;
          internal_links_count: number | null;
          external_references: Json | null;
          external_links_count: number | null;
          article_metadata: Json | null;
          wordpress_post_id: number | null;
          wordpress_post_url: string | null;
          wordpress_status: string | null;
          featured_image_url: string | null;
          featured_image_alt: string | null;
          content_images: Json | null;
          quality_score: number | null;
          quality_passed: boolean | null;
          quality_issues: Json | null;
          research_model: string | null;
          strategy_model: string | null;
          writing_model: string | null;
          meta_model: string | null;
          generation_time: number | null;
          token_usage: Json | null;
          cost_breakdown: Json | null;
          status: "generated" | "reviewed" | "published" | "archived" | null;
          published_at: string | null;
          created_at: string | null;
          updated_at: string | null;
          published_to_website_id: string | null;
          published_to_website_at: string | null;
          content_json: Json | null;
          scheduled_publish_at: string | null;
          target_wordpress_status: "draft" | "publish" | null;
          publish_retry_count: number | null;
          last_publish_error: string | null;
        };
        Insert: {
          id?: string;
          article_job_id?: string | null;
          company_id?: string | null;
          website_id?: string | null;
          brand_id?: string | null;
          user_id?: string | null;
          title: string;
          slug: string;
          markdown_content: string;
          html_content: string;
          excerpt?: string | null;
          seo_title?: string | null;
          seo_description?: string | null;
          focus_keyword?: string | null;
          keywords?: string[] | null;
          og_title?: string | null;
          og_description?: string | null;
          og_image?: string | null;
          twitter_card_type?: string | null;
          twitter_title?: string | null;
          twitter_description?: string | null;
          twitter_image?: string | null;
          categories?: string[] | null;
          tags?: string[] | null;
          word_count?: number | null;
          reading_time?: number | null;
          paragraph_count?: number | null;
          sentence_count?: number | null;
          flesch_reading_ease?: number | null;
          flesch_kincaid_grade?: number | null;
          gunning_fog_index?: number | null;
          keyword_density?: number | null;
          keyword_usage_count?: number | null;
          internal_links?: Json | null;
          internal_links_count?: number | null;
          external_references?: Json | null;
          external_links_count?: number | null;
          article_metadata?: Json | null;
          wordpress_post_id?: number | null;
          wordpress_post_url?: string | null;
          wordpress_status?: string | null;
          featured_image_url?: string | null;
          featured_image_alt?: string | null;
          content_images?: Json | null;
          quality_score?: number | null;
          quality_passed?: boolean | null;
          quality_issues?: Json | null;
          research_model?: string | null;
          strategy_model?: string | null;
          writing_model?: string | null;
          meta_model?: string | null;
          generation_time?: number | null;
          token_usage?: Json | null;
          cost_breakdown?: Json | null;
          status?: "generated" | "reviewed" | "published" | "archived" | null;
          published_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          published_to_website_id?: string | null;
          published_to_website_at?: string | null;
          content_json?: Json | null;
          scheduled_publish_at?: string | null;
          target_wordpress_status?: "draft" | "publish" | null;
          publish_retry_count?: number | null;
          last_publish_error?: string | null;
        };
        Update: {
          id?: string;
          article_job_id?: string | null;
          company_id?: string | null;
          website_id?: string | null;
          brand_id?: string | null;
          user_id?: string | null;
          title?: string;
          slug?: string;
          markdown_content?: string;
          html_content?: string;
          excerpt?: string | null;
          seo_title?: string | null;
          seo_description?: string | null;
          focus_keyword?: string | null;
          keywords?: string[] | null;
          og_title?: string | null;
          og_description?: string | null;
          og_image?: string | null;
          twitter_card_type?: string | null;
          twitter_title?: string | null;
          twitter_description?: string | null;
          twitter_image?: string | null;
          categories?: string[] | null;
          tags?: string[] | null;
          word_count?: number | null;
          reading_time?: number | null;
          paragraph_count?: number | null;
          sentence_count?: number | null;
          flesch_reading_ease?: number | null;
          flesch_kincaid_grade?: number | null;
          gunning_fog_index?: number | null;
          keyword_density?: number | null;
          keyword_usage_count?: number | null;
          internal_links?: Json | null;
          internal_links_count?: number | null;
          external_references?: Json | null;
          external_links_count?: number | null;
          article_metadata?: Json | null;
          wordpress_post_id?: number | null;
          wordpress_post_url?: string | null;
          wordpress_status?: string | null;
          featured_image_url?: string | null;
          featured_image_alt?: string | null;
          content_images?: Json | null;
          quality_score?: number | null;
          quality_passed?: boolean | null;
          quality_issues?: Json | null;
          research_model?: string | null;
          strategy_model?: string | null;
          writing_model?: string | null;
          meta_model?: string | null;
          generation_time?: number | null;
          token_usage?: Json | null;
          cost_breakdown?: Json | null;
          status?: "generated" | "reviewed" | "published" | "archived" | null;
          published_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          published_to_website_id?: string | null;
          published_to_website_at?: string | null;
          content_json?: Json | null;
          scheduled_publish_at?: string | null;
          target_wordpress_status?: "draft" | "publish" | null;
          publish_retry_count?: number | null;
          last_publish_error?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "generated_articles_article_job_id_fkey";
            columns: ["article_job_id"];
            isOneToOne: false;
            referencedRelation: "article_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "generated_articles_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "generated_articles_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "generated_articles_published_to_website_id_fkey";
            columns: ["published_to_website_id"];
            isOneToOne: false;
            referencedRelation: "website_configs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "generated_articles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "generated_articles_website_id_fkey";
            columns: ["website_id"];
            isOneToOne: false;
            referencedRelation: "website_configs";
            referencedColumns: ["id"];
          },
        ];
      };
      website_configs: {
        Row: {
          id: string;
          company_id: string | null;
          brand_id: string | null;
          website_name: string;
          wordpress_url: string;
          wordpress_oauth_client_id: string | null;
          wordpress_oauth_client_secret: string | null;
          wordpress_access_token: string | null;
          wordpress_refresh_token: string | null;
          wordpress_token_expires_at: string | null;
          language: string | null;
          api_config: Json | null;
          is_active: boolean | null;
          created_at: string | null;
          updated_at: string | null;
          created_by: string | null;
          wp_username: string | null;
          wp_app_password: string | null;
          wp_enabled: boolean | null;
          is_platform_blog: boolean | null;
          daily_article_limit: number | null;
          auto_schedule_enabled: boolean | null;
          schedule_type: "daily" | "interval" | null;
          schedule_interval_days: number | null;
          auto_translate_enabled: boolean | null;
          auto_translate_languages: string[] | null;
          // 外部網站相關欄位
          website_type:
            | "wordpress"
            | "platform_blog"
            | "external"
            | "shopline"
            | null;
          webhook_url: string | null;
          webhook_secret: string | null;
          sync_on_publish: boolean | null;
          sync_on_update: boolean | null;
          sync_on_unpublish: boolean | null;
          sync_translations: boolean | null;
          sync_languages: string[] | null;
          last_synced_at: string | null;
          last_sync_status: string | null;
          last_sync_error: string | null;
          external_slug: string | null;
        };
        Insert: {
          id?: string;
          company_id?: string | null;
          brand_id?: string | null;
          website_name: string;
          wordpress_url: string;
          wordpress_oauth_client_id?: string | null;
          wordpress_oauth_client_secret?: string | null;
          wordpress_access_token?: string | null;
          wordpress_refresh_token?: string | null;
          wordpress_token_expires_at?: string | null;
          language?: string | null;
          api_config?: Json | null;
          is_active?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
          created_by?: string | null;
          wp_username?: string | null;
          wp_app_password?: string | null;
          wp_enabled?: boolean | null;
          is_platform_blog?: boolean | null;
          daily_article_limit?: number | null;
          auto_schedule_enabled?: boolean | null;
          schedule_type?: "daily" | "interval" | null;
          schedule_interval_days?: number | null;
          auto_translate_enabled?: boolean | null;
          auto_translate_languages?: string[] | null;
          // 外部網站相關欄位
          website_type?:
            | "wordpress"
            | "platform_blog"
            | "external"
            | "shopline"
            | null;
          webhook_url?: string | null;
          webhook_secret?: string | null;
          sync_on_publish?: boolean | null;
          sync_on_update?: boolean | null;
          sync_on_unpublish?: boolean | null;
          sync_translations?: boolean | null;
          sync_languages?: string[] | null;
          last_synced_at?: string | null;
          last_sync_status?: string | null;
          last_sync_error?: string | null;
          external_slug?: string | null;
        };
        Update: {
          id?: string;
          company_id?: string | null;
          brand_id?: string | null;
          website_name?: string;
          wordpress_url?: string;
          wordpress_oauth_client_id?: string | null;
          wordpress_oauth_client_secret?: string | null;
          wordpress_access_token?: string | null;
          wordpress_refresh_token?: string | null;
          wordpress_token_expires_at?: string | null;
          language?: string | null;
          api_config?: Json | null;
          is_active?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
          created_by?: string | null;
          wp_username?: string | null;
          wp_app_password?: string | null;
          wp_enabled?: boolean | null;
          is_platform_blog?: boolean | null;
          daily_article_limit?: number | null;
          auto_schedule_enabled?: boolean | null;
          schedule_type?: "daily" | "interval" | null;
          schedule_interval_days?: number | null;
          auto_translate_enabled?: boolean | null;
          auto_translate_languages?: string[] | null;
          // 外部網站相關欄位
          website_type?:
            | "wordpress"
            | "platform_blog"
            | "external"
            | "shopline"
            | null;
          webhook_url?: string | null;
          webhook_secret?: string | null;
          sync_on_publish?: boolean | null;
          sync_on_update?: boolean | null;
          sync_on_unpublish?: boolean | null;
          sync_translations?: boolean | null;
          sync_languages?: string[] | null;
          last_synced_at?: string | null;
          last_sync_status?: string | null;
          last_sync_error?: string | null;
          external_slug?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "website_configs_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "website_configs_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
        ];
      };
      article_views: {
        Row: {
          id: string;
          article_id: string;
          total_views: number;
          unique_views: number;
          views_today: number;
          views_this_week: number;
          views_this_month: number;
          last_viewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          article_id: string;
          total_views?: number;
          unique_views?: number;
          views_today?: number;
          views_this_week?: number;
          views_this_month?: number;
          last_viewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          article_id?: string;
          total_views?: number;
          unique_views?: number;
          views_today?: number;
          views_this_week?: number;
          views_this_month?: number;
          last_viewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "article_views_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: true;
            referencedRelation: "generated_articles";
            referencedColumns: ["id"];
          },
        ];
      };
      promo_codes: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string | null;
          bonus_articles: number;
          max_uses: number | null;
          current_uses: number;
          starts_at: string;
          expires_at: string | null;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          description?: string | null;
          bonus_articles: number;
          max_uses?: number | null;
          current_uses?: number;
          starts_at?: string;
          expires_at?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          description?: string | null;
          bonus_articles?: number;
          max_uses?: number | null;
          current_uses?: number;
          starts_at?: string;
          expires_at?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "promo_codes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      promo_code_usages: {
        Row: {
          id: string;
          promo_code_id: string;
          company_id: string;
          payment_order_id: string | null;
          bonus_articles: number;
          used_at: string;
        };
        Insert: {
          id?: string;
          promo_code_id: string;
          company_id: string;
          payment_order_id?: string | null;
          bonus_articles: number;
          used_at?: string;
        };
        Update: {
          id?: string;
          promo_code_id?: string;
          company_id?: string;
          payment_order_id?: string | null;
          bonus_articles?: number;
          used_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "promo_code_usages_promo_code_id_fkey";
            columns: ["promo_code_id"];
            isOneToOne: false;
            referencedRelation: "promo_codes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "promo_code_usages_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      admin_action_logs: {
        Row: {
          id: string;
          admin_user_id: string;
          admin_email: string;
          action_type:
            | "extend_subscription"
            | "grant_articles"
            | "adjust_subscription"
            | "create_promo_code"
            | "update_promo_code"
            | "deactivate_promo_code"
            | "manual_adjustment"
            | "other";
          target_type: "company" | "subscription" | "promo_code";
          target_id: string;
          target_name: string | null;
          action_details: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          admin_user_id: string;
          admin_email: string;
          action_type:
            | "extend_subscription"
            | "grant_articles"
            | "adjust_subscription"
            | "create_promo_code"
            | "update_promo_code"
            | "deactivate_promo_code"
            | "manual_adjustment"
            | "other";
          target_type: "company" | "subscription" | "promo_code";
          target_id: string;
          target_name?: string | null;
          action_details?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          admin_user_id?: string;
          admin_email?: string;
          action_type?:
            | "extend_subscription"
            | "grant_articles"
            | "adjust_subscription"
            | "create_promo_code"
            | "update_promo_code"
            | "deactivate_promo_code"
            | "manual_adjustment"
            | "other";
          target_type?: "company" | "subscription" | "promo_code";
          target_id?: string;
          target_name?: string | null;
          action_details?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "admin_action_logs_admin_user_id_fkey";
            columns: ["admin_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      sync_targets: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          webhook_url: string;
          webhook_secret: string;
          sync_on_publish: boolean;
          sync_on_update: boolean;
          sync_on_unpublish: boolean;
          sync_translations: boolean;
          sync_languages: string[];
          is_active: boolean;
          last_synced_at: string | null;
          last_sync_status: string | null;
          last_sync_error: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          webhook_url: string;
          webhook_secret: string;
          sync_on_publish?: boolean;
          sync_on_update?: boolean;
          sync_on_unpublish?: boolean;
          sync_translations?: boolean;
          sync_languages?: string[];
          is_active?: boolean;
          last_synced_at?: string | null;
          last_sync_status?: string | null;
          last_sync_error?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          webhook_url?: string;
          webhook_secret?: string;
          sync_on_publish?: boolean;
          sync_on_update?: boolean;
          sync_on_unpublish?: boolean;
          sync_translations?: boolean;
          sync_languages?: string[];
          is_active?: boolean;
          last_synced_at?: string | null;
          last_sync_status?: string | null;
          last_sync_error?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      article_sync_logs: {
        Row: {
          id: string;
          article_id: string;
          sync_target_id: string;
          external_website_id: string | null;
          translation_id: string | null;
          action: "create" | "update" | "delete";
          status: "pending" | "processing" | "success" | "failed" | "retrying";
          webhook_url: string;
          request_payload: Json | null;
          response_status: number | null;
          response_body: string | null;
          error_message: string | null;
          retry_count: number;
          max_retries: number;
          next_retry_at: string | null;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          metadata: Json;
        };
        Insert: {
          id?: string;
          article_id: string;
          sync_target_id?: string;
          external_website_id?: string | null;
          translation_id?: string | null;
          action: "create" | "update" | "delete";
          status?: "pending" | "processing" | "success" | "failed" | "retrying";
          webhook_url: string;
          request_payload?: Json | null;
          response_status?: number | null;
          response_body?: string | null;
          error_message?: string | null;
          retry_count?: number;
          max_retries?: number;
          next_retry_at?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          metadata?: Json;
        };
        Update: {
          id?: string;
          article_id?: string;
          sync_target_id?: string;
          external_website_id?: string | null;
          translation_id?: string | null;
          action?: "create" | "update" | "delete";
          status?: "pending" | "processing" | "success" | "failed" | "retrying";
          webhook_url?: string;
          request_payload?: Json | null;
          response_status?: number | null;
          response_body?: string | null;
          error_message?: string | null;
          retry_count?: number;
          max_retries?: number;
          next_retry_at?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          metadata?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "article_sync_logs_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: false;
            referencedRelation: "generated_articles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "article_sync_logs_sync_target_id_fkey";
            columns: ["sync_target_id"];
            isOneToOne: false;
            referencedRelation: "sync_targets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "article_sync_logs_translation_id_fkey";
            columns: ["translation_id"];
            isOneToOne: false;
            referencedRelation: "article_translations";
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
