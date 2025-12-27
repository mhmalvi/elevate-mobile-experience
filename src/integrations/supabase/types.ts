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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      clients: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          postcode: string | null
          state: string | null
          suburb: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          postcode?: string | null
          state?: string | null
          suburb?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          postcode?: string | null
          state?: string | null
          suburb?: string | null
          updated_at?: string
          user_id?: string
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
          description: string | null
          due_date: string | null
          gst: number | null
          id: string
          invoice_number: string
          is_recurring: boolean | null
          job_id: string | null
          next_due_date: string | null
          notes: string | null
          paid_at: string | null
          parent_invoice_id: string | null
          quote_id: string | null
          recurring_interval: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["invoice_status"] | null
          subtotal: number | null
          terms: string | null
          title: string
          total: number | null
          updated_at: string
          user_id: string
          viewed_at: string | null
        }
        Insert: {
          amount_paid?: number | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          gst?: number | null
          id?: string
          invoice_number: string
          is_recurring?: boolean | null
          job_id?: string | null
          next_due_date?: string | null
          notes?: string | null
          paid_at?: string | null
          parent_invoice_id?: string | null
          quote_id?: string | null
          recurring_interval?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          subtotal?: number | null
          terms?: string | null
          title: string
          total?: number | null
          updated_at?: string
          user_id: string
          viewed_at?: string | null
        }
        Update: {
          amount_paid?: number | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          gst?: number | null
          id?: string
          invoice_number?: string
          is_recurring?: boolean | null
          job_id?: string | null
          next_due_date?: string | null
          notes?: string | null
          paid_at?: string | null
          parent_invoice_id?: string | null
          quote_id?: string | null
          recurring_interval?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          subtotal?: number | null
          terms?: string | null
          title?: string
          total?: number | null
          updated_at?: string
          user_id?: string
          viewed_at?: string | null
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
        ]
      }
      jobs: {
        Row: {
          actual_hours: number | null
          client_id: string | null
          completed_at: string | null
          created_at: string
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
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_hours?: number | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
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
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_hours?: number | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
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
        ]
      }
      profiles: {
        Row: {
          abn: string | null
          address: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_bsb: string | null
          bank_name: string | null
          business_name: string | null
          created_at: string
          default_hourly_rate: number | null
          email: string | null
          gst_registered: boolean | null
          id: string
          license_number: string | null
          logo_url: string | null
          onboarding_completed: boolean | null
          payment_terms: number | null
          phone: string | null
          stripe_account_id: string | null
          subscription_tier: string | null
          trade_type: Database["public"]["Enums"]["trade_type"] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          abn?: string | null
          address?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_bsb?: string | null
          bank_name?: string | null
          business_name?: string | null
          created_at?: string
          default_hourly_rate?: number | null
          email?: string | null
          gst_registered?: boolean | null
          id?: string
          license_number?: string | null
          logo_url?: string | null
          onboarding_completed?: boolean | null
          payment_terms?: number | null
          phone?: string | null
          stripe_account_id?: string | null
          subscription_tier?: string | null
          trade_type?: Database["public"]["Enums"]["trade_type"] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          abn?: string | null
          address?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_bsb?: string | null
          bank_name?: string | null
          business_name?: string | null
          created_at?: string
          default_hourly_rate?: number | null
          email?: string | null
          gst_registered?: boolean | null
          id?: string
          license_number?: string | null
          logo_url?: string | null
          onboarding_completed?: boolean | null
          payment_terms?: number | null
          phone?: string | null
          stripe_account_id?: string | null
          subscription_tier?: string | null
          trade_type?: Database["public"]["Enums"]["trade_type"] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          is_system: boolean | null
          name: string
          trade_type: Database["public"]["Enums"]["trade_type"] | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          default_items?: Json | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          trade_type?: Database["public"]["Enums"]["trade_type"] | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          default_items?: Json | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          trade_type?: Database["public"]["Enums"]["trade_type"] | null
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
          description: string | null
          gst: number | null
          id: string
          notes: string | null
          quote_number: string
          sent_at: string | null
          signature_data: string | null
          status: Database["public"]["Enums"]["quote_status"] | null
          subtotal: number | null
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
          description?: string | null
          gst?: number | null
          id?: string
          notes?: string | null
          quote_number: string
          sent_at?: string | null
          signature_data?: string | null
          status?: Database["public"]["Enums"]["quote_status"] | null
          subtotal?: number | null
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
          description?: string | null
          gst?: number | null
          id?: string
          notes?: string | null
          quote_number?: string
          sent_at?: string | null
          signature_data?: string | null
          status?: Database["public"]["Enums"]["quote_status"] | null
          subtotal?: number | null
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
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
