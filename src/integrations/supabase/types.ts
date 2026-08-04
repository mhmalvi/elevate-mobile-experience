export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      branding_settings: {
        Row: {
          accent_color: string | null
          created_at: string | null
          default_invoice_terms: string | null
          default_quote_terms: string | null
          document_footer_text: string | null
          document_header_style: string | null
          email_footer_text: string | null
          email_header_color: string | null
          email_signature: string | null
          id: string
          logo_position: string | null
          logo_url: string | null
          primary_color: string | null
          secondary_color: string | null
          show_logo_on_documents: boolean | null
          text_color: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          accent_color?: string | null
          created_at?: string | null
          default_invoice_terms?: string | null
          default_quote_terms?: string | null
          document_footer_text?: string | null
          document_header_style?: string | null
          email_footer_text?: string | null
          email_header_color?: string | null
          email_signature?: string | null
          id?: string
          logo_position?: string | null
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          show_logo_on_documents?: boolean | null
          text_color?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          accent_color?: string | null
          created_at?: string | null
          default_invoice_terms?: string | null
          default_quote_terms?: string | null
          document_footer_text?: string | null
          document_header_style?: string | null
          email_footer_text?: string | null
          email_header_color?: string | null
          email_signature?: string | null
          id?: string
          logo_position?: string | null
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          show_logo_on_documents?: boolean | null
          text_color?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          id: string
          last_synced_to_myob: string | null
          last_synced_to_qb: string | null
          last_synced_to_xero: string | null
          myob_sync_error: string | null
          myob_uid: string | null
          name: string
          notes: string | null
          phone: string | null
          postcode: string | null
          qb_customer_id: string | null
          qb_sync_error: string | null
          state: string | null
          suburb: string | null
          team_id: string | null
          updated_at: string
          user_id: string
          xero_contact_id: string | null
          xero_sync_error: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          last_synced_to_myob?: string | null
          last_synced_to_qb?: string | null
          last_synced_to_xero?: string | null
          myob_sync_error?: string | null
          myob_uid?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          postcode?: string | null
          qb_customer_id?: string | null
          qb_sync_error?: string | null
          state?: string | null
          suburb?: string | null
          team_id?: string | null
          updated_at?: string
          user_id: string
          xero_contact_id?: string | null
          xero_sync_error?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          last_synced_to_myob?: string | null
          last_synced_to_qb?: string | null
          last_synced_to_xero?: string | null
          myob_sync_error?: string | null
          myob_uid?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          postcode?: string | null
          qb_customer_id?: string | null
          qb_sync_error?: string | null
          state?: string | null
          suburb?: string | null
          team_id?: string | null
          updated_at?: string
          user_id?: string
          xero_contact_id?: string | null
          xero_sync_error?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_sync_log: {
        Row: {
          created_at: string | null
          entity_id: string
          entity_type: string
          error_message: string | null
          id: string
          sync_direction: string
          sync_status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          entity_id: string
          entity_type: string
          error_message?: string | null
          id?: string
          sync_direction: string
          sync_status: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          error_message?: string | null
          id?: string
          sync_direction?: string
          sync_status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      invoice_line_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          item_type: string | null
          quantity: number | null
          sort_order: number | null
          total: number
          unit: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          item_type?: string | null
          quantity?: number | null
          sort_order?: number | null
          total: number
          unit?: string | null
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          item_type?: string | null
          quantity?: number | null
          sort_order?: number | null
          total?: number
          unit?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "active_recurring_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number | null
          client_id: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          due_date: string | null
          id: string
          invoice_number: string
          is_recurring: boolean | null
          job_id: string | null
          last_synced_to_myob: string | null
          last_synced_to_qb: string | null
          last_synced_to_xero: string | null
          myob_sync_error: string | null
          myob_uid: string | null
          next_due_date: string | null
          notes: string | null
          paid_at: string | null
          parent_invoice_id: string | null
          qb_invoice_id: string | null
          qb_sync_error: string | null
          quote_id: string | null
          recurring_interval: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["invoice_status"] | null
          stripe_payment_link: string | null
          subtotal: number | null
          tax_amount: number | null
          team_id: string | null
          terms: string | null
          title: string
          total: number | null
          updated_at: string
          user_id: string
          viewed_at: string | null
          xero_invoice_id: string | null
          xero_sync_error: string | null
          xero_sync_status: string | null
        }
        Insert: {
          amount_paid?: number | null
          client_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_number: string
          is_recurring?: boolean | null
          job_id?: string | null
          last_synced_to_myob?: string | null
          last_synced_to_qb?: string | null
          last_synced_to_xero?: string | null
          myob_sync_error?: string | null
          myob_uid?: string | null
          next_due_date?: string | null
          notes?: string | null
          paid_at?: string | null
          parent_invoice_id?: string | null
          qb_invoice_id?: string | null
          qb_sync_error?: string | null
          quote_id?: string | null
          recurring_interval?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          stripe_payment_link?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          team_id?: string | null
          terms?: string | null
          title: string
          total?: number | null
          updated_at?: string
          user_id: string
          viewed_at?: string | null
          xero_invoice_id?: string | null
          xero_sync_error?: string | null
          xero_sync_status?: string | null
        }
        Update: {
          amount_paid?: number | null
          client_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          is_recurring?: boolean | null
          job_id?: string | null
          last_synced_to_myob?: string | null
          last_synced_to_qb?: string | null
          last_synced_to_xero?: string | null
          myob_sync_error?: string | null
          myob_uid?: string | null
          next_due_date?: string | null
          notes?: string | null
          paid_at?: string | null
          parent_invoice_id?: string | null
          qb_invoice_id?: string | null
          qb_sync_error?: string | null
          quote_id?: string | null
          recurring_interval?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          stripe_payment_link?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          team_id?: string | null
          terms?: string | null
          title?: string
          total?: number | null
          updated_at?: string
          user_id?: string
          viewed_at?: string | null
          xero_invoice_id?: string | null
          xero_sync_error?: string | null
          xero_sync_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_parent_invoice_id_fkey"
            columns: ["parent_invoice_id"]
            isOneToOne: false
            referencedRelation: "active_recurring_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_parent_invoice_id_fkey"
            columns: ["parent_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          actual_hours: number | null
          assigned_to: string | null
          client_id: string | null
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          end_time: string | null
          id: string
          material_costs: number | null
          notes: string | null
          quote_id: string | null
          scheduled_date: string | null
          site_address: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["job_status"] | null
          team_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_hours?: number | null
          assigned_to?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          end_time?: string | null
          id?: string
          material_costs?: number | null
          notes?: string | null
          quote_id?: string | null
          scheduled_date?: string | null
          site_address?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["job_status"] | null
          team_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_hours?: number | null
          assigned_to?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          end_time?: string | null
          id?: string
          material_costs?: number | null
          notes?: string | null
          quote_id?: string | null
          scheduled_date?: string | null
          site_address?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["job_status"] | null
          team_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          bank_account_name: string | null
          bank_account_name_encrypted: string | null
          bank_account_number: string | null
          bank_account_number_encrypted: string | null
          bank_bsb: string | null
          bank_bsb_encrypted: string | null
          bank_name: string | null
          bank_name_encrypted: string | null
          business_name: string | null
          business_number: string | null
          country_code: string
          created_at: string
          currency_code: string
          default_hourly_rate: number | null
          email: string | null
          id: string
          license_number: string | null
          locale: string | null
          logo_url: string | null
          myob_access_token: string | null
          myob_company_file_id: string | null
          myob_company_file_uri: string | null
          myob_connected_at: string | null
          myob_expires_at: string | null
          myob_refresh_token: string | null
          myob_sync_enabled: boolean | null
          onboarding_completed: boolean | null
          payment_terms: number | null
          phone: string | null
          qb_access_token: string | null
          qb_connected_at: string | null
          qb_realm_id: string | null
          qb_refresh_token: string | null
          qb_sync_enabled: boolean | null
          qb_token_expires_at: string | null
          stripe_account_id: string | null
          stripe_charges_enabled: boolean | null
          stripe_onboarding_complete: boolean | null
          subscription_expires_at: string | null
          subscription_id: string | null
          subscription_provider: string | null
          subscription_tier: string | null
          tax_inclusive_pricing: boolean
          tax_label: string
          tax_rate: number
          tax_registered: boolean | null
          team_id: string | null
          trade_type: Database["public"]["Enums"]["trade_type"] | null
          updated_at: string
          user_id: string
          xero_access_token: string | null
          xero_connected_at: string | null
          xero_refresh_token: string | null
          xero_sync_enabled: boolean | null
          xero_tenant_id: string | null
          xero_token_expires_at: string | null
        }
        Insert: {
          address?: string | null
          bank_account_name?: string | null
          bank_account_name_encrypted?: string | null
          bank_account_number?: string | null
          bank_account_number_encrypted?: string | null
          bank_bsb?: string | null
          bank_bsb_encrypted?: string | null
          bank_name?: string | null
          bank_name_encrypted?: string | null
          business_name?: string | null
          business_number?: string | null
          country_code?: string
          created_at?: string
          currency_code?: string
          default_hourly_rate?: number | null
          email?: string | null
          id?: string
          license_number?: string | null
          locale?: string | null
          logo_url?: string | null
          myob_access_token?: string | null
          myob_company_file_id?: string | null
          myob_company_file_uri?: string | null
          myob_connected_at?: string | null
          myob_expires_at?: string | null
          myob_refresh_token?: string | null
          myob_sync_enabled?: boolean | null
          onboarding_completed?: boolean | null
          payment_terms?: number | null
          phone?: string | null
          qb_access_token?: string | null
          qb_connected_at?: string | null
          qb_realm_id?: string | null
          qb_refresh_token?: string | null
          qb_sync_enabled?: boolean | null
          qb_token_expires_at?: string | null
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean | null
          stripe_onboarding_complete?: boolean | null
          subscription_expires_at?: string | null
          subscription_id?: string | null
          subscription_provider?: string | null
          subscription_tier?: string | null
          tax_inclusive_pricing?: boolean
          tax_label?: string
          tax_rate?: number
          tax_registered?: boolean | null
          team_id?: string | null
          trade_type?: Database["public"]["Enums"]["trade_type"] | null
          updated_at?: string
          user_id: string
          xero_access_token?: string | null
          xero_connected_at?: string | null
          xero_refresh_token?: string | null
          xero_sync_enabled?: boolean | null
          xero_tenant_id?: string | null
          xero_token_expires_at?: string | null
        }
        Update: {
          address?: string | null
          bank_account_name?: string | null
          bank_account_name_encrypted?: string | null
          bank_account_number?: string | null
          bank_account_number_encrypted?: string | null
          bank_bsb?: string | null
          bank_bsb_encrypted?: string | null
          bank_name?: string | null
          bank_name_encrypted?: string | null
          business_name?: string | null
          business_number?: string | null
          country_code?: string
          created_at?: string
          currency_code?: string
          default_hourly_rate?: number | null
          email?: string | null
          id?: string
          license_number?: string | null
          locale?: string | null
          logo_url?: string | null
          myob_access_token?: string | null
          myob_company_file_id?: string | null
          myob_company_file_uri?: string | null
          myob_connected_at?: string | null
          myob_expires_at?: string | null
          myob_refresh_token?: string | null
          myob_sync_enabled?: boolean | null
          onboarding_completed?: boolean | null
          payment_terms?: number | null
          phone?: string | null
          qb_access_token?: string | null
          qb_connected_at?: string | null
          qb_realm_id?: string | null
          qb_refresh_token?: string | null
          qb_sync_enabled?: boolean | null
          qb_token_expires_at?: string | null
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean | null
          stripe_onboarding_complete?: boolean | null
          subscription_expires_at?: string | null
          subscription_id?: string | null
          subscription_provider?: string | null
          subscription_tier?: string | null
          tax_inclusive_pricing?: boolean
          tax_label?: string
          tax_rate?: number
          tax_registered?: boolean | null
          team_id?: string | null
          trade_type?: Database["public"]["Enums"]["trade_type"] | null
          updated_at?: string
          user_id?: string
          xero_access_token?: string | null
          xero_connected_at?: string | null
          xero_refresh_token?: string | null
          xero_sync_enabled?: boolean | null
          xero_tenant_id?: string | null
          xero_token_expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_line_items: {
        Row: {
          created_at: string
          description: string
          id: string
          item_type: string | null
          quantity: number | null
          quote_id: string
          sort_order: number | null
          total: number
          unit: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          item_type?: string | null
          quantity?: number | null
          quote_id: string
          sort_order?: number | null
          total: number
          unit?: string | null
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          item_type?: string | null
          quantity?: number | null
          quote_id?: string
          sort_order?: number | null
          total?: number
          unit?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_line_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_templates: {
        Row: {
          created_at: string
          default_items: Json | null
          description: string | null
          id: string
          is_public: boolean | null
          is_system: boolean | null
          name: string
          trade_type: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          default_items?: Json | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          is_system?: boolean | null
          name: string
          trade_type?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          default_items?: Json | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          is_system?: boolean | null
          name?: string
          trade_type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      quotes: {
        Row: {
          accepted_at: string | null
          client_id: string | null
          created_at: string
          declined_at: string | null
          deleted_at: string | null
          description: string | null
          id: string
          notes: string | null
          quote_number: string
          sent_at: string | null
          signature_data: string | null
          status: Database["public"]["Enums"]["quote_status"] | null
          subtotal: number | null
          tax_amount: number | null
          team_id: string | null
          terms: string | null
          title: string
          total: number | null
          updated_at: string
          user_id: string
          valid_until: string | null
          viewed_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          client_id?: string | null
          created_at?: string
          declined_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          quote_number: string
          sent_at?: string | null
          signature_data?: string | null
          status?: Database["public"]["Enums"]["quote_status"] | null
          subtotal?: number | null
          tax_amount?: number | null
          team_id?: string | null
          terms?: string | null
          title: string
          total?: number | null
          updated_at?: string
          user_id: string
          valid_until?: string | null
          viewed_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          client_id?: string | null
          created_at?: string
          declined_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          quote_number?: string
          sent_at?: string | null
          signature_data?: string | null
          status?: Database["public"]["Enums"]["quote_status"] | null
          subtotal?: number | null
          tax_amount?: number | null
          team_id?: string | null
          terms?: string | null
          title?: string
          total?: number | null
          updated_at?: string
          user_id?: string
          valid_until?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          created_at: string
          id: string
          key: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
        }
        Relationships: []
      }
      subcontractors: {
        Row: {
          business_number: string | null
          created_at: string
          email: string | null
          hourly_rate: number | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          trade: string
          updated_at: string
          user_id: string
        }
        Insert: {
          business_number?: string | null
          created_at?: string
          email?: string | null
          hourly_rate?: number | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          trade?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          business_number?: string | null
          created_at?: string
          email?: string | null
          hourly_rate?: number | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          trade?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      team_invitations: {
        Row: {
          accepted: boolean | null
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: string
          team_id: string
          token: string
        }
        Insert: {
          accepted?: boolean | null
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          invited_by: string
          role: string
          team_id: string
          token: string
        }
        Update: {
          accepted?: boolean | null
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: string
          team_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: string
          joined_at: string | null
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string | null
          role: string
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string | null
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string | null
          id: string
          name: string
          owner_id: string
          subscription_tier: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          owner_id: string
          subscription_tier?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          owner_id?: string
          subscription_tier?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      timesheet_entries: {
        Row: {
          break_minutes: number | null
          created_at: string
          description: string | null
          end_time: string | null
          entry_date: string
          hours: number
          id: string
          job_id: string | null
          start_time: string | null
          timesheet_id: string
          updated_at: string
        }
        Insert: {
          break_minutes?: number | null
          created_at?: string
          description?: string | null
          end_time?: string | null
          entry_date: string
          hours?: number
          id?: string
          job_id?: string | null
          start_time?: string | null
          timesheet_id: string
          updated_at?: string
        }
        Update: {
          break_minutes?: number | null
          created_at?: string
          description?: string | null
          end_time?: string | null
          entry_date?: string
          hours?: number
          id?: string
          job_id?: string | null
          start_time?: string | null
          timesheet_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_entries_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_entries_timesheet_id_fkey"
            columns: ["timesheet_id"]
            isOneToOne: false
            referencedRelation: "timesheets"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheets: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          member_id: string
          notes: string | null
          status: string
          submitted_at: string | null
          team_id: string | null
          total_hours: number | null
          updated_at: string
          user_id: string
          week_starting: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          member_id: string
          notes?: string | null
          status?: string
          submitted_at?: string | null
          team_id?: string | null
          total_hours?: number | null
          updated_at?: string
          user_id: string
          week_starting: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          member_id?: string
          notes?: string | null
          status?: string
          submitted_at?: string | null
          team_id?: string | null
          total_hours?: number | null
          updated_at?: string
          user_id?: string
          week_starting?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheets_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_tracking: {
        Row: {
          clients_created: number | null
          created_at: string
          emails_sent: number | null
          id: string
          invoices_created: number | null
          jobs_created: number | null
          month_year: string
          quotes_created: number | null
          sms_sent: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          clients_created?: number | null
          created_at?: string
          emails_sent?: number | null
          id?: string
          invoices_created?: number | null
          jobs_created?: number | null
          month_year: string
          quotes_created?: number | null
          sms_sent?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          clients_created?: number | null
          created_at?: string
          emails_sent?: number | null
          id?: string
          invoices_created?: number | null
          jobs_created?: number | null
          month_year?: string
          quotes_created?: number | null
          sms_sent?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          created_at: string
          error_message: string | null
          event_id: string
          event_type: string
          id: string
          processed_at: string
          processing_result: string | null
          raw_event: Json | null
          source: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_id: string
          event_type: string
          id?: string
          processed_at?: string
          processing_result?: string | null
          raw_event?: Json | null
          source: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_id?: string
          event_type?: string
          id?: string
          processed_at?: string
          processing_result?: string | null
          raw_event?: Json | null
          source?: string
        }
        Relationships: []
      }
    }
    Views: {
      active_recurring_invoices: {
        Row: {
          amount_paid: number | null
          business_name: string | null
          client_email: string | null
          client_id: string | null
          client_name: string | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          due_date: string | null
          id: string | null
          invoice_number: string | null
          is_recurring: boolean | null
          job_id: string | null
          last_synced_to_myob: string | null
          last_synced_to_qb: string | null
          last_synced_to_xero: string | null
          myob_sync_error: string | null
          myob_uid: string | null
          next_due_date: string | null
          notes: string | null
          paid_at: string | null
          parent_invoice_id: string | null
          qb_invoice_id: string | null
          qb_sync_error: string | null
          quote_id: string | null
          recurring_interval: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["invoice_status"] | null
          stripe_payment_link: string | null
          subscription_tier: string | null
          subtotal: number | null
          tax_amount: number | null
          team_id: string | null
          terms: string | null
          title: string | null
          total: number | null
          updated_at: string | null
          user_id: string | null
          viewed_at: string | null
          xero_invoice_id: string | null
          xero_sync_error: string | null
          xero_sync_status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_parent_invoice_id_fkey"
            columns: ["parent_invoice_id"]
            isOneToOne: false
            referencedRelation: "active_recurring_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_parent_invoice_id_fkey"
            columns: ["parent_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calculate_next_due_date: {
        Args: { from_date: string; interval_type: string }
        Returns: string
      }
      cleanup_old_webhook_events: { Args: never; Returns: undefined }
      daitch_mokotoff: { Args: { "": string }; Returns: string[] }
      dmetaphone: { Args: { "": string }; Returns: string }
      dmetaphone_alt: { Args: { "": string }; Returns: string }
      get_invitation_by_token: {
        Args: { lookup_token: string }
        Returns: {
          accepted: boolean
          email: string
          expires_at: string
          id: string
          role: string
          team_name: string
          token: string
        }[]
      }
      get_user_team_role: {
        Args: { p_team_id: string; p_user_id: string }
        Returns: string
      }
      search_clients_fuzzy: {
        Args: { p_limit?: number; p_search_term: string; p_user_id: string }
        Returns: {
          confidence: number
          email: string
          id: string
          match_type: string
          name: string
          phone: string
          suburb: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      soundex: { Args: { "": string }; Returns: string }
      test_auth: { Args: never; Returns: Json }
      text_soundex: { Args: { "": string }; Returns: string }
      user_has_team_role: {
        Args: { p_roles: string[]; p_team_id: string; p_user_id: string }
        Returns: boolean
      }
      user_is_team_member: {
        Args: { p_team_id: string; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      invoice_status:
        | "draft"
        | "sent"
        | "viewed"
        | "paid"
        | "partially_paid"
        | "overdue"
        | "cancelled"
      job_status:
        | "quoted"
        | "approved"
        | "scheduled"
        | "in_progress"
        | "completed"
        | "invoiced"
      quote_status:
        | "draft"
        | "sent"
        | "viewed"
        | "accepted"
        | "declined"
        | "expired"
      trade_type:
        | "electrician"
        | "plumber"
        | "carpenter"
        | "builder"
        | "painter"
        | "landscaper"
        | "hvac"
        | "roofer"
        | "tiler"
        | "other"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      invoice_status: [
        "draft",
        "sent",
        "viewed",
        "paid",
        "partially_paid",
        "overdue",
        "cancelled",
      ],
      job_status: [
        "quoted",
        "approved",
        "scheduled",
        "in_progress",
        "completed",
        "invoiced",
      ],
      quote_status: [
        "draft",
        "sent",
        "viewed",
        "accepted",
        "declined",
        "expired",
      ],
      trade_type: [
        "electrician",
        "plumber",
        "carpenter",
        "builder",
        "painter",
        "landscaper",
        "hvac",
        "roofer",
        "tiler",
        "other",
      ],
    },
  },
} as const
