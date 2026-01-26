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
      ai_settings: {
        Row: {
          company_info: string | null
          created_at: string | null
          custom_instructions: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          company_info?: string | null
          created_at?: string | null
          custom_instructions?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          company_info?: string | null
          created_at?: string | null
          custom_instructions?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          created_at: string | null
          description: string | null
          employee_count: string | null
          id: string
          industry: string | null
          is_contacted: boolean | null
          linkedin_url: string
          location: string | null
          name: string
          notes: string | null
          raw_data: Json | null
          revenue_range: string | null
          stars: number | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          employee_count?: string | null
          id?: string
          industry?: string | null
          is_contacted?: boolean | null
          linkedin_url: string
          location?: string | null
          name: string
          notes?: string | null
          raw_data?: Json | null
          revenue_range?: string | null
          stars?: number | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          employee_count?: string | null
          id?: string
          industry?: string | null
          is_contacted?: boolean | null
          linkedin_url?: string
          location?: string | null
          name?: string
          notes?: string | null
          raw_data?: Json | null
          revenue_range?: string | null
          stars?: number | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      emails: {
        Row: {
          body_html: string | null
          body_text: string | null
          created_at: string | null
          direction: string
          from_email: string
          gmail_message_id: string
          gmail_thread_id: string | null
          id: string
          is_reply: boolean | null
          person_id: string | null
          sent_at: string
          subject: string | null
          to_email: string
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          created_at?: string | null
          direction: string
          from_email: string
          gmail_message_id: string
          gmail_thread_id?: string | null
          id?: string
          is_reply?: boolean | null
          person_id?: string | null
          sent_at: string
          subject?: string | null
          to_email: string
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          created_at?: string | null
          direction?: string
          from_email?: string
          gmail_message_id?: string
          gmail_thread_id?: string | null
          id?: string
          is_reply?: boolean | null
          person_id?: string | null
          sent_at?: string
          subject?: string | null
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "emails_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      google_auth: {
        Row: {
          access_token: string
          created_at: string | null
          email: string
          id: string
          last_sync_at: string | null
          refresh_token: string
          token_expires_at: string
          updated_at: string | null
        }
        Insert: {
          access_token: string
          created_at?: string | null
          email: string
          id?: string
          last_sync_at?: string | null
          refresh_token: string
          token_expires_at: string
          updated_at?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string | null
          email?: string
          id?: string
          last_sync_at?: string | null
          refresh_token?: string
          token_expires_at?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_current: boolean | null
          name: string
          notes: string | null
          profile_id: string
          type: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_current?: boolean | null
          name: string
          notes?: string | null
          profile_id: string
          type: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_current?: boolean | null
          name?: string
          notes?: string | null
          profile_id?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string | null
          direction: string
          id: string
          person_id: string
          type: string
        }
        Insert: {
          content: string
          created_at?: string | null
          direction: string
          id?: string
          person_id: string
          type: string
        }
        Update: {
          content?: string
          created_at?: string | null
          direction?: string
          id?: string
          person_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          outcome: string | null
          person_id: string
          template_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          outcome?: string | null
          person_id: string
          template_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          outcome?: string | null
          person_id?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outreach_logs_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          apollo_enriched_at: string | null
          apollo_id: string | null
          city: string | null
          company_id: string | null
          company_linkedin_url: string | null
          company_name: string | null
          connections_count: number | null
          country: string | null
          created_at: string | null
          departments: string[] | null
          email: string | null
          email_status: string | null
          email_zerobounce_at: string | null
          email_zerobounce_status: string | null
          email_zerobounce_sub_status: string | null
          facebook_url: string | null
          followers_count: number | null
          github_url: string | null
          headline: string | null
          id: string
          linkedin_profile_url: string | null
          linkedin_url: string
          name: string
          notes: string | null
          phone_number: string | null
          photo_url: string | null
          raw_data: Json | null
          seniority: string | null
          state: string | null
          status: string | null
          title: string | null
          twitter_url: string | null
          updated_at: string | null
          warm_intro_referrer: string | null
        }
        Insert: {
          apollo_enriched_at?: string | null
          apollo_id?: string | null
          city?: string | null
          company_id?: string | null
          company_linkedin_url?: string | null
          company_name?: string | null
          connections_count?: number | null
          country?: string | null
          created_at?: string | null
          departments?: string[] | null
          email?: string | null
          email_status?: string | null
          email_zerobounce_at?: string | null
          email_zerobounce_status?: string | null
          email_zerobounce_sub_status?: string | null
          facebook_url?: string | null
          followers_count?: number | null
          github_url?: string | null
          headline?: string | null
          id?: string
          linkedin_profile_url?: string | null
          linkedin_url: string
          name: string
          notes?: string | null
          phone_number?: string | null
          photo_url?: string | null
          raw_data?: Json | null
          seniority?: string | null
          state?: string | null
          status?: string | null
          title?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          warm_intro_referrer?: string | null
        }
        Update: {
          apollo_enriched_at?: string | null
          apollo_id?: string | null
          city?: string | null
          company_id?: string | null
          company_linkedin_url?: string | null
          company_name?: string | null
          connections_count?: number | null
          country?: string | null
          created_at?: string | null
          departments?: string[] | null
          email?: string | null
          email_status?: string | null
          email_zerobounce_at?: string | null
          email_zerobounce_status?: string | null
          email_zerobounce_sub_status?: string | null
          facebook_url?: string | null
          followers_count?: number | null
          github_url?: string | null
          headline?: string | null
          id?: string
          linkedin_profile_url?: string | null
          linkedin_url?: string
          name?: string
          notes?: string | null
          phone_number?: string | null
          photo_url?: string | null
          raw_data?: Json | null
          seniority?: string | null
          state?: string | null
          status?: string | null
          title?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          warm_intro_referrer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          id: string
          industry: string | null
          notes: string | null
          pain_points: string[]
          roles: string[]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          industry?: string | null
          notes?: string | null
          pain_points?: string[]
          roles?: string[]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          industry?: string | null
          notes?: string | null
          pain_points?: string[]
          roles?: string[]
          updated_at?: string | null
        }
        Relationships: []
      }
      todos: {
        Row: {
          completed: boolean | null
          created_at: string | null
          description: string | null
          due_date: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          priority: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          completed?: boolean | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          priority?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          completed?: boolean | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          priority?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
