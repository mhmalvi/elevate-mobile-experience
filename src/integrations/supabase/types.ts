export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          user_id: string
          email: string | null
          business_name: string | null
          abn: string | null
          trade_type: string | null
          phone: string | null
          address: string | null
          logo_url: string | null
          default_hourly_rate: number | null
          license_number: string | null
          gst_registered: boolean | null
          payment_terms: number | null
          onboarding_completed: boolean | null
          team_id: string | null
          // Stripe Connect
          stripe_account_id: string | null
          stripe_onboarding_complete: boolean | null
          stripe_charges_enabled: boolean | null
          // Subscription
          subscription_tier: string | null
          subscription_provider: string | null
          subscription_id: string | null
          subscription_expires_at: string | null
          // Xero integration
          xero_tenant_id: string | null
          xero_access_token: string | null
          xero_refresh_token: string | null
          xero_token_expires_at: string | null
          xero_sync_enabled: boolean | null
          xero_connected_at: string | null
          // QuickBooks integration
          qb_realm_id: string | null
          qb_access_token: string | null
          qb_refresh_token: string | null
          qb_token_expires_at: string | null
          qb_sync_enabled: boolean | null
          qb_connected_at: string | null
          qb_refresh_token_expires_at: string | null
          // Stripe customer
          stripe_customer_id: string | null
          // Encrypted bank details
          bank_name: string | null
          bank_bsb: string | null
          bank_account_number: string | null
          bank_account_name: string | null
          bank_name_encrypted: string | null
          bank_bsb_encrypted: string | null
          bank_account_number_encrypted: string | null
          bank_account_name_encrypted: string | null
          // Timestamps
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          email?: string | null
          business_name?: string | null
          abn?: string | null
          trade_type?: string | null
          phone?: string | null
          address?: string | null
          logo_url?: string | null
          default_hourly_rate?: number | null
          license_number?: string | null
          gst_registered?: boolean | null
          payment_terms?: number | null
          onboarding_completed?: boolean | null
          team_id?: string | null
          stripe_account_id?: string | null
          stripe_onboarding_complete?: boolean | null
          stripe_charges_enabled?: boolean | null
          subscription_tier?: string | null
          subscription_provider?: string | null
          subscription_id?: string | null
          subscription_expires_at?: string | null
          xero_tenant_id?: string | null
          xero_access_token?: string | null
          xero_refresh_token?: string | null
          xero_token_expires_at?: string | null
          xero_sync_enabled?: boolean | null
          xero_connected_at?: string | null
          qb_realm_id?: string | null
          qb_access_token?: string | null
          qb_refresh_token?: string | null
          qb_token_expires_at?: string | null
          qb_sync_enabled?: boolean | null
          qb_connected_at?: string | null
          qb_refresh_token_expires_at?: string | null
          stripe_customer_id?: string | null
          bank_name?: string | null
          bank_bsb?: string | null
          bank_account_number?: string | null
          bank_account_name?: string | null
          bank_name_encrypted?: string | null
          bank_bsb_encrypted?: string | null
          bank_account_number_encrypted?: string | null
          bank_account_name_encrypted?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          email?: string | null
          business_name?: string | null
          abn?: string | null
          trade_type?: string | null
          phone?: string | null
          address?: string | null
          logo_url?: string | null
          default_hourly_rate?: number | null
          license_number?: string | null
          gst_registered?: boolean | null
          payment_terms?: number | null
          onboarding_completed?: boolean | null
          team_id?: string | null
          stripe_account_id?: string | null
          stripe_onboarding_complete?: boolean | null
          stripe_charges_enabled?: boolean | null
          subscription_tier?: string | null
          subscription_provider?: string | null
          subscription_id?: string | null
          subscription_expires_at?: string | null
          xero_tenant_id?: string | null
          xero_access_token?: string | null
          xero_refresh_token?: string | null
          xero_token_expires_at?: string | null
          xero_sync_enabled?: boolean | null
          xero_connected_at?: string | null
          qb_realm_id?: string | null
          qb_access_token?: string | null
          qb_refresh_token?: string | null
          qb_token_expires_at?: string | null
          qb_sync_enabled?: boolean | null
          qb_connected_at?: string | null
          qb_refresh_token_expires_at?: string | null
          stripe_customer_id?: string | null
          bank_name?: string | null
          bank_bsb?: string | null
          bank_account_number?: string | null
          bank_account_name?: string | null
          bank_name_encrypted?: string | null
          bank_bsb_encrypted?: string | null
          bank_account_number_encrypted?: string | null
          bank_account_name_encrypted?: string | null
          created_at?: string | null
          updated_at?: string | null
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
      clients: {
        Row: {
          id: string
          user_id: string
          team_id: string | null
          name: string
          email: string | null
          phone: string | null
          address: string | null
          suburb: string | null
          state: string | null
          postcode: string | null
          notes: string | null
          // Xero sync
          xero_contact_id: string | null
          last_synced_to_xero: string | null
          xero_sync_error: string | null
          // QuickBooks sync
          qb_customer_id: string | null
          last_synced_to_qb: string | null
          qb_sync_error: string | null
          // Timestamps
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          team_id?: string | null
          name: string
          email?: string | null
          phone?: string | null
          address?: string | null
          suburb?: string | null
          state?: string | null
          postcode?: string | null
          notes?: string | null
          xero_contact_id?: string | null
          last_synced_to_xero?: string | null
          xero_sync_error?: string | null
          qb_customer_id?: string | null
          last_synced_to_qb?: string | null
          qb_sync_error?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          team_id?: string | null
          name?: string
          email?: string | null
          phone?: string | null
          address?: string | null
          suburb?: string | null
          state?: string | null
          postcode?: string | null
          notes?: string | null
          xero_contact_id?: string | null
          last_synced_to_xero?: string | null
          xero_sync_error?: string | null
          qb_customer_id?: string | null
          last_synced_to_qb?: string | null
          qb_sync_error?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
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
      jobs: {
        Row: {
          id: string
          user_id: string
          team_id: string | null
          client_id: string | null
          quote_id: string | null
          title: string
          description: string | null
          status: string
          site_address: string | null
          scheduled_date: string | null
          notes: string | null
          material_cost: number | null
          assigned_to: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          team_id?: string | null
          client_id?: string | null
          quote_id?: string | null
          title: string
          description?: string | null
          status?: string
          site_address?: string | null
          scheduled_date?: string | null
          notes?: string | null
          material_cost?: number | null
          assigned_to?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          team_id?: string | null
          client_id?: string | null
          quote_id?: string | null
          title?: string
          description?: string | null
          status?: string
          site_address?: string | null
          scheduled_date?: string | null
          notes?: string | null
          material_cost?: number | null
          assigned_to?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
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
          {
            foreignKeyName: "jobs_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      quotes: {
        Row: {
          id: string
          user_id: string
          team_id: string | null
          client_id: string | null
          quote_number: string
          title: string
          description: string | null
          notes: string | null
          status: string
          subtotal: number
          gst: number
          total: number
          valid_until: string | null
          accepted_at: string | null
          public_token: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          team_id?: string | null
          client_id?: string | null
          quote_number: string
          title: string
          description?: string | null
          notes?: string | null
          status?: string
          subtotal?: number
          gst?: number
          total?: number
          valid_until?: string | null
          accepted_at?: string | null
          public_token?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          team_id?: string | null
          client_id?: string | null
          quote_number?: string
          title?: string
          description?: string | null
          notes?: string | null
          status?: string
          subtotal?: number
          gst?: number
          total?: number
          valid_until?: string | null
          accepted_at?: string | null
          public_token?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
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
      quote_line_items: {
        Row: {
          id: string
          quote_id: string
          description: string
          quantity: number
          unit: string | null
          unit_price: number
          total: number
          item_type: string | null
          sort_order: number | null
          created_at: string
        }
        Insert: {
          id?: string
          quote_id: string
          description: string
          quantity?: number
          unit?: string | null
          unit_price?: number
          total?: number
          item_type?: string | null
          sort_order?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          quote_id?: string
          description?: string
          quantity?: number
          unit?: string | null
          unit_price?: number
          total?: number
          item_type?: string | null
          sort_order?: number | null
          created_at?: string
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
      invoices: {
        Row: {
          id: string
          user_id: string
          team_id: string | null
          client_id: string | null
          job_id: string | null
          quote_id: string | null
          invoice_number: string
          title: string
          description: string | null
          notes: string | null
          status: string
          subtotal: number
          gst: number
          total: number
          amount_paid: number
          due_date: string | null
          paid_at: string | null
          sent_at: string | null
          // Recurring invoice fields
          is_recurring: boolean | null
          recurring_interval: string | null
          next_due_date: string | null
          parent_invoice_id: string | null
          // Stripe
          stripe_payment_link: string | null
          // Xero sync
          xero_invoice_id: string | null
          last_synced_to_xero: string | null
          xero_sync_error: string | null
          xero_sync_status: string | null
          // QuickBooks sync
          qb_invoice_id: string | null
          last_synced_to_qb: string | null
          qb_sync_error: string | null
          // Public access token
          public_token: string | null
          // Timestamps
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          team_id?: string | null
          client_id?: string | null
          job_id?: string | null
          quote_id?: string | null
          invoice_number: string
          title: string
          description?: string | null
          notes?: string | null
          status?: string
          subtotal?: number
          gst?: number
          total?: number
          amount_paid?: number
          due_date?: string | null
          paid_at?: string | null
          sent_at?: string | null
          is_recurring?: boolean | null
          recurring_interval?: string | null
          next_due_date?: string | null
          parent_invoice_id?: string | null
          stripe_payment_link?: string | null
          xero_invoice_id?: string | null
          last_synced_to_xero?: string | null
          xero_sync_error?: string | null
          xero_sync_status?: string | null
          qb_invoice_id?: string | null
          last_synced_to_qb?: string | null
          qb_sync_error?: string | null
          public_token?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          team_id?: string | null
          client_id?: string | null
          job_id?: string | null
          quote_id?: string | null
          invoice_number?: string
          title?: string
          description?: string | null
          notes?: string | null
          status?: string
          subtotal?: number
          gst?: number
          total?: number
          amount_paid?: number
          due_date?: string | null
          paid_at?: string | null
          sent_at?: string | null
          is_recurring?: boolean | null
          recurring_interval?: string | null
          next_due_date?: string | null
          parent_invoice_id?: string | null
          stripe_payment_link?: string | null
          xero_invoice_id?: string | null
          last_synced_to_xero?: string | null
          xero_sync_error?: string | null
          xero_sync_status?: string | null
          qb_invoice_id?: string | null
          last_synced_to_qb?: string | null
          qb_sync_error?: string | null
          public_token?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
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
          {
            foreignKeyName: "invoices_parent_invoice_id_fkey"
            columns: ["parent_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          id: string
          invoice_id: string
          description: string
          quantity: number
          unit: string | null
          unit_price: number
          total: number
          item_type: string | null
          sort_order: number | null
          created_at: string
        }
        Insert: {
          id?: string
          invoice_id: string
          description: string
          quantity?: number
          unit?: string | null
          unit_price?: number
          total?: number
          item_type?: string | null
          sort_order?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          invoice_id?: string
          description?: string
          quantity?: number
          unit?: string | null
          unit_price?: number
          total?: number
          item_type?: string | null
          sort_order?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          id: string
          name: string
          owner_id: string
          subscription_tier: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          owner_id: string
          subscription_tier?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          owner_id?: string
          subscription_tier?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      team_members: {
        Row: {
          id: string
          team_id: string
          user_id: string
          role: string
          joined_at: string | null
        }
        Insert: {
          id?: string
          team_id: string
          user_id: string
          role: string
          joined_at?: string | null
        }
        Update: {
          id?: string
          team_id?: string
          user_id?: string
          role?: string
          joined_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invitations: {
        Row: {
          id: string
          team_id: string
          email: string
          role: string
          token: string
          invited_by: string
          accepted: boolean | null
          expires_at: string
          created_at: string | null
        }
        Insert: {
          id?: string
          team_id: string
          email: string
          role: string
          token: string
          invited_by: string
          accepted?: boolean | null
          expires_at: string
          created_at?: string | null
        }
        Update: {
          id?: string
          team_id?: string
          email?: string
          role?: string
          token?: string
          invited_by?: string
          accepted?: boolean | null
          expires_at?: string
          created_at?: string | null
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
      subcontractors: {
        Row: {
          id: string
          user_id: string
          team_id: string | null
          name: string
          trade: string
          phone: string | null
          email: string | null
          abn: string | null
          hourly_rate: number | null
          notes: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          team_id?: string | null
          name: string
          trade?: string
          phone?: string | null
          email?: string | null
          abn?: string | null
          hourly_rate?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          team_id?: string | null
          name?: string
          trade?: string
          phone?: string | null
          email?: string | null
          abn?: string | null
          hourly_rate?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subcontractors_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheets: {
        Row: {
          id: string
          user_id: string
          team_id: string | null
          member_id: string
          week_starting: string
          status: string
          total_hours: number | null
          notes: string | null
          approved_by: string | null
          approved_at: string | null
          submitted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          team_id?: string | null
          member_id: string
          week_starting: string
          status?: string
          total_hours?: number | null
          notes?: string | null
          approved_by?: string | null
          approved_at?: string | null
          submitted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          team_id?: string | null
          member_id?: string
          week_starting?: string
          status?: string
          total_hours?: number | null
          notes?: string | null
          approved_by?: string | null
          approved_at?: string | null
          submitted_at?: string | null
          created_at?: string
          updated_at?: string
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
      timesheet_entries: {
        Row: {
          id: string
          timesheet_id: string
          entry_date: string
          start_time: string | null
          end_time: string | null
          break_minutes: number | null
          hours: number
          job_id: string | null
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          timesheet_id: string
          entry_date: string
          start_time?: string | null
          end_time?: string | null
          break_minutes?: number | null
          hours?: number
          job_id?: string | null
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          timesheet_id?: string
          entry_date?: string
          start_time?: string | null
          end_time?: string | null
          break_minutes?: number | null
          hours?: number
          job_id?: string | null
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_entries_timesheet_id_fkey"
            columns: ["timesheet_id"]
            isOneToOne: false
            referencedRelation: "timesheets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_entries_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_tracking: {
        Row: {
          id: string
          user_id: string
          month_year: string
          quotes_created: number
          invoices_created: number
          jobs_created: number
          clients_created: number
          emails_sent: number
          sms_sent: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          month_year: string
          quotes_created?: number
          invoices_created?: number
          jobs_created?: number
          clients_created?: number
          emails_sent?: number
          sms_sent?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          month_year?: string
          quotes_created?: number
          invoices_created?: number
          jobs_created?: number
          clients_created?: number
          emails_sent?: number
          sms_sent?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      branding_settings: {
        Row: {
          id: string
          user_id: string
          // Logo settings
          logo_url: string | null
          logo_position: string | null
          show_logo_on_documents: boolean | null
          // Color settings
          primary_color: string | null
          secondary_color: string | null
          text_color: string | null
          accent_color: string | null
          // Email branding
          email_header_color: string | null
          email_footer_text: string | null
          email_signature: string | null
          // Document branding
          document_header_style: string | null
          default_quote_terms: string | null
          default_invoice_terms: string | null
          document_footer_text: string | null
          // Timestamps
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          logo_url?: string | null
          logo_position?: string | null
          show_logo_on_documents?: boolean | null
          primary_color?: string | null
          secondary_color?: string | null
          text_color?: string | null
          accent_color?: string | null
          email_header_color?: string | null
          email_footer_text?: string | null
          email_signature?: string | null
          document_header_style?: string | null
          default_quote_terms?: string | null
          default_invoice_terms?: string | null
          document_footer_text?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          logo_url?: string | null
          logo_position?: string | null
          show_logo_on_documents?: boolean | null
          primary_color?: string | null
          secondary_color?: string | null
          text_color?: string | null
          accent_color?: string | null
          email_header_color?: string | null
          email_footer_text?: string | null
          email_signature?: string | null
          document_header_style?: string | null
          default_quote_terms?: string | null
          default_invoice_terms?: string | null
          document_footer_text?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          id: string
          event_id: string
          event_type: string
          source: string
          processed_at: string
          raw_event: Json | null
          processing_result: string | null
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          event_type: string
          source: string
          processed_at?: string
          raw_event?: Json | null
          processing_result?: string | null
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          event_type?: string
          source?: string
          processed_at?: string
          raw_event?: Json | null
          processing_result?: string | null
          error_message?: string | null
          created_at?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          id: string
          key: string
          created_at: string
        }
        Insert: {
          id?: string
          key: string
          created_at?: string
        }
        Update: {
          id?: string
          key?: string
          created_at?: string
        }
        Relationships: []
      }
      quote_templates: {
        Row: {
          id: string
          trade_type: string
          name: string
          description: string | null
          default_items: Json
          is_public: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          trade_type: string
          name: string
          description?: string | null
          default_items?: Json
          is_public?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          trade_type?: string
          name?: string
          description?: string | null
          default_items?: Json
          is_public?: boolean | null
          created_at?: string | null
        }
        Relationships: []
      }
      integration_sync_log: {
        Row: {
          id: string
          user_id: string | null
          entity_type: string
          entity_id: string
          sync_direction: string
          sync_status: string
          error_message: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          entity_type: string
          entity_id: string
          sync_direction: string
          sync_status: string
          error_message?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          entity_type?: string
          entity_id?: string
          sync_direction?: string
          sync_status?: string
          error_message?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      document_sequences: {
        Row: {
          id: string
          user_id: string
          document_type: string
          prefix: string
          next_number: number
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          document_type: string
          prefix?: string
          next_number?: number
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          document_type?: string
          prefix?: string
          next_number?: number
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      timesheets: {
        Row: {
          id: string
          user_id: string
          team_id: string | null
          member_id: string
          week_starting: string
          status: string
          total_hours: number
          notes: string | null
          approved_by: string | null
          approved_at: string | null
          submitted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          team_id?: string | null
          member_id: string
          week_starting: string
          status?: string
          total_hours?: number
          notes?: string | null
          approved_by?: string | null
          approved_at?: string | null
          submitted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          team_id?: string | null
          member_id?: string
          week_starting?: string
          status?: string
          total_hours?: number
          notes?: string | null
          approved_by?: string | null
          approved_at?: string | null
          submitted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      timesheet_entries: {
        Row: {
          id: string
          timesheet_id: string
          entry_date: string
          start_time: string | null
          end_time: string | null
          break_minutes: number
          hours: number
          job_id: string | null
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          timesheet_id: string
          entry_date: string
          start_time?: string | null
          end_time?: string | null
          break_minutes?: number
          hours?: number
          job_id?: string | null
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          timesheet_id?: string
          entry_date?: string
          start_time?: string | null
          end_time?: string | null
          break_minutes?: number
          hours?: number
          job_id?: string | null
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      subcontractors: {
        Row: {
          id: string
          user_id: string
          team_id: string | null
          name: string
          trade: string
          phone: string | null
          email: string | null
          abn: string | null
          hourly_rate: number | null
          notes: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          team_id?: string | null
          name: string
          trade?: string
          phone?: string | null
          email?: string | null
          abn?: string | null
          hourly_rate?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          team_id?: string | null
          name?: string
          trade?: string
          phone?: string | null
          email?: string | null
          abn?: string | null
          hourly_rate?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      active_recurring_invoices: {
        Row: {
          id: string | null
          user_id: string | null
          client_id: string | null
          invoice_number: string | null
          title: string | null
          status: string | null
          total: number | null
          is_recurring: boolean | null
          recurring_interval: string | null
          next_due_date: string | null
          client_name: string | null
          client_email: string | null
          business_name: string | null
          subscription_tier: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_user_team_role: {
        Args: {
          p_team_id: string
          p_user_id: string
        }
        Returns: string
      }
      get_next_document_number: {
        Args: {
          p_document_type: string
          p_prefix?: string
        }
        Returns: string
      }
      calculate_next_due_date: {
        Args: {
          current_date: string
          interval_type: string
        }
        Returns: string
      }
      cleanup_old_webhook_events: {
        Args: Record<string, never>
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// ============================================================================
// Helper types
// ============================================================================

/** Extract the Row type for a given table name */
export type Tables<
  PublicTableNameOrOptions extends
    | keyof (Database["public"]["Tables"] & Database["public"]["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"] &
        Database["public"]["Views"])
    ? (Database["public"]["Tables"] &
        Database["public"]["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

/** Extract the Insert type for a given table name */
export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

/** Extract the Update type for a given table name */
export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

/** Extract the Enum type for a given enum name */
export type Enums<
  PublicEnumNameOrOptions extends
    | keyof Database["public"]["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof Database["public"]["Enums"]
    ? Database["public"]["Enums"][PublicEnumNameOrOptions]
    : never
