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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_parse_cache: {
        Row: {
          created_at: string
          expires_at: string
          hit_count: number | null
          id: string
          prompt_hash: string
          provider: string
          response_json: Json
          text_hash: string
          tokens_used: number | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          hit_count?: number | null
          id?: string
          prompt_hash: string
          provider: string
          response_json: Json
          text_hash: string
          tokens_used?: number | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          hit_count?: number | null
          id?: string
          prompt_hash?: string
          provider?: string
          response_json?: Json
          text_hash?: string
          tokens_used?: number | null
        }
        Relationships: []
      }
      case_arguments: {
        Row: {
          created_at: string | null
          docket_id: string | null
          highlight_coords: Json | null
          id: string
          linked_page_number: number | null
          title: string
        }
        Insert: {
          created_at?: string | null
          docket_id?: string | null
          highlight_coords?: Json | null
          id?: string
          linked_page_number?: number | null
          title: string
        }
        Update: {
          created_at?: string | null
          docket_id?: string | null
          highlight_coords?: Json | null
          id?: string
          linked_page_number?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_arguments_docket_id_fkey"
            columns: ["docket_id"]
            isOneToOne: false
            referencedRelation: "daily_court_docket"
            referencedColumns: ["id"]
          },
        ]
      }
      case_documents: {
        Row: {
          doc_type: string | null
          docket_id: string | null
          document_type: Database["public"]["Enums"]["document_type"] | null
          file_url: string | null
          format: Database["public"]["Enums"]["document_format"] | null
          id: string
          is_primary: boolean | null
          language: Database["public"]["Enums"]["document_language"] | null
          legibility: Database["public"]["Enums"]["document_legibility"] | null
          pending_review: boolean | null
          review_status: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          uploaded_at: string | null
          uploaded_by: string | null
          version: number | null
        }
        Insert: {
          doc_type?: string | null
          docket_id?: string | null
          document_type?: Database["public"]["Enums"]["document_type"] | null
          file_url?: string | null
          format?: Database["public"]["Enums"]["document_format"] | null
          id?: string
          is_primary?: boolean | null
          language?: Database["public"]["Enums"]["document_language"] | null
          legibility?: Database["public"]["Enums"]["document_legibility"] | null
          pending_review?: boolean | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          version?: number | null
        }
        Update: {
          doc_type?: string | null
          docket_id?: string | null
          document_type?: Database["public"]["Enums"]["document_type"] | null
          file_url?: string | null
          format?: Database["public"]["Enums"]["document_format"] | null
          id?: string
          is_primary?: boolean | null
          language?: Database["public"]["Enums"]["document_language"] | null
          legibility?: Database["public"]["Enums"]["document_legibility"] | null
          pending_review?: boolean | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "case_documents_docket_id_fkey"
            columns: ["docket_id"]
            isOneToOne: false
            referencedRelation: "daily_court_docket"
            referencedColumns: ["id"]
          },
        ]
      }
      case_parse_queue: {
        Row: {
          cases_parsed: number | null
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          item_range: string | null
          last_retry_at: string | null
          matched_alias: string
          page_range: string | null
          profile_id: string
          provider_used: string | null
          raw_causelist_id: string
          retry_count: number | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          cases_parsed?: number | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          item_range?: string | null
          last_retry_at?: string | null
          matched_alias: string
          page_range?: string | null
          profile_id: string
          provider_used?: string | null
          raw_causelist_id: string
          retry_count?: number | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          cases_parsed?: number | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          item_range?: string | null
          last_retry_at?: string | null
          matched_alias?: string
          page_range?: string | null
          profile_id?: string
          provider_used?: string | null
          raw_causelist_id?: string
          retry_count?: number | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_parse_queue_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_parse_queue_raw_causelist_id_fkey"
            columns: ["raw_causelist_id"]
            isOneToOne: false
            referencedRelation: "raw_causelists"
            referencedColumns: ["id"]
          },
        ]
      }
      cause_list_notes: {
        Row: {
          created_at: string | null
          id: string
          note_text: string
          note_type: string | null
          page_number: number | null
          raw_causelist_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          note_text: string
          note_type?: string | null
          page_number?: number | null
          raw_causelist_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          note_text?: string
          note_type?: string | null
          page_number?: number | null
          raw_causelist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cause_list_notes_raw_causelist_id_fkey"
            columns: ["raw_causelist_id"]
            isOneToOne: false
            referencedRelation: "raw_causelists"
            referencedColumns: ["id"]
          },
        ]
      }
      court_metadata: {
        Row: {
          bench: string
          court_no: string
          id: string
          last_updated: string | null
          sitting_judges: string | null
        }
        Insert: {
          bench: string
          court_no: string
          id?: string
          last_updated?: string | null
          sitting_judges?: string | null
        }
        Update: {
          bench?: string
          court_no?: string
          id?: string
          last_updated?: string | null
          sitting_judges?: string | null
        }
        Relationships: []
      }
      daily_court_docket: {
        Row: {
          case_fingerprint: string | null
          case_number: string | null
          court_location: string | null
          court_room_no: string | null
          created_at: string | null
          date: string
          fingerprint_matched_at: string | null
          force_active: boolean | null
          id: string
          item_no: number | null
          judge_names: string | null
          list_type: string | null
          matched_profile_id: string | null
          petitioner: string | null
          petitioner_lawyer: string | null
          respondent: string | null
          respondent_lawyer: string | null
          source_url: string | null
          status: string | null
        }
        Insert: {
          case_fingerprint?: string | null
          case_number?: string | null
          court_location?: string | null
          court_room_no?: string | null
          created_at?: string | null
          date?: string
          fingerprint_matched_at?: string | null
          force_active?: boolean | null
          id?: string
          item_no?: number | null
          judge_names?: string | null
          list_type?: string | null
          matched_profile_id?: string | null
          petitioner?: string | null
          petitioner_lawyer?: string | null
          respondent?: string | null
          respondent_lawyer?: string | null
          source_url?: string | null
          status?: string | null
        }
        Update: {
          case_fingerprint?: string | null
          case_number?: string | null
          court_location?: string | null
          court_room_no?: string | null
          created_at?: string | null
          date?: string
          fingerprint_matched_at?: string | null
          force_active?: boolean | null
          id?: string
          item_no?: number | null
          judge_names?: string | null
          list_type?: string | null
          matched_profile_id?: string | null
          petitioner?: string | null
          petitioner_lawyer?: string | null
          respondent?: string | null
          respondent_lawyer?: string | null
          source_url?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_court_docket_matched_profile_id_fkey"
            columns: ["matched_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      data_validation_logs: {
        Row: {
          court_location: string | null
          court_no: string | null
          created_at: string | null
          details: Json | null
          id: string
          status: string
          validation_type: string
        }
        Insert: {
          court_location?: string | null
          court_no?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          status: string
          validation_type: string
        }
        Update: {
          court_location?: string | null
          court_no?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          status?: string
          validation_type?: string
        }
        Relationships: []
      }
      document_annotations: {
        Row: {
          annotation_json: Json
          annotation_type: string | null
          created_at: string | null
          document_id: string | null
          id: string
          page_number: number
          user_id: string
        }
        Insert: {
          annotation_json: Json
          annotation_type?: string | null
          created_at?: string | null
          document_id?: string | null
          id?: string
          page_number: number
          user_id: string
        }
        Update: {
          annotation_json?: Json
          annotation_type?: string | null
          created_at?: string | null
          document_id?: string | null
          id?: string
          page_number?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_annotations_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "case_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_processing_queue: {
        Row: {
          bench: string
          chat_id: number
          completed_at: string | null
          court_no: string | null
          created_at: string
          error_message: string | null
          file_id: string
          file_name: string | null
          id: string
          list_type: string
          message_date: string
          started_at: string | null
          status: string
          telegram_message_id: number
          telegram_update_id: number
        }
        Insert: {
          bench: string
          chat_id: number
          completed_at?: string | null
          court_no?: string | null
          created_at?: string
          error_message?: string | null
          file_id: string
          file_name?: string | null
          id?: string
          list_type: string
          message_date: string
          started_at?: string | null
          status?: string
          telegram_message_id: number
          telegram_update_id: number
        }
        Update: {
          bench?: string
          chat_id?: number
          completed_at?: string | null
          court_no?: string | null
          created_at?: string
          error_message?: string | null
          file_id?: string
          file_name?: string | null
          id?: string
          list_type?: string
          message_date?: string
          started_at?: string | null
          status?: string
          telegram_message_id?: number
          telegram_update_id?: number
        }
        Relationships: []
      }
      judge_judgment_references: {
        Row: {
          added_at: string
          added_by: string | null
          case_type: string
          court: string
          id: string
          indian_kanoon_url: string
          judge_name: string
          judgment_date: string
          lawyer_names: string[] | null
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          case_type: string
          court: string
          id?: string
          indian_kanoon_url: string
          judge_name: string
          judgment_date: string
          lawyer_names?: string[] | null
        }
        Update: {
          added_at?: string
          added_by?: string | null
          case_type?: string
          court?: string
          id?: string
          indian_kanoon_url?: string
          judge_name?: string
          judgment_date?: string
          lawyer_names?: string[] | null
        }
        Relationships: []
      }
      lawyer_aliases: {
        Row: {
          alias_name: string
          created_at: string | null
          id: string
          is_primary: boolean | null
          profile_id: string
        }
        Insert: {
          alias_name: string
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          profile_id: string
        }
        Update: {
          alias_name?: string
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lawyer_aliases_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_board_cache: {
        Row: {
          court_location: string
          court_no: string
          cross_court_from: string | null
          current_item: number | null
          is_active: boolean | null
          is_supplementary_running: boolean | null
          last_updated: string | null
          list_type: string | null
          source_timestamp: string | null
          status: string | null
        }
        Insert: {
          court_location: string
          court_no: string
          cross_court_from?: string | null
          current_item?: number | null
          is_active?: boolean | null
          is_supplementary_running?: boolean | null
          last_updated?: string | null
          list_type?: string | null
          source_timestamp?: string | null
          status?: string | null
        }
        Update: {
          court_location?: string
          court_no?: string
          cross_court_from?: string | null
          current_item?: number | null
          is_active?: boolean | null
          is_supplementary_running?: boolean | null
          last_updated?: string | null
          list_type?: string | null
          source_timestamp?: string | null
          status?: string | null
        }
        Relationships: []
      }
      live_courtroom_feed: {
        Row: {
          created_at: string | null
          docket_id: string | null
          id: string
          is_read: boolean | null
          message: string
          sender_id: string | null
        }
        Insert: {
          created_at?: string | null
          docket_id?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          sender_id?: string | null
        }
        Update: {
          created_at?: string | null
          docket_id?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_courtroom_feed_docket_id_fkey"
            columns: ["docket_id"]
            isOneToOne: false
            referencedRelation: "daily_court_docket"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_courtroom_feed_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_court_notes: {
        Row: {
          author_id: string
          case_fingerprint: string
          created_at: string
          docket_id: string | null
          hearing_date: string
          id: string
          next_direction: string | null
          note_for_next: string | null
          updated_at: string
          what_happened: string | null
        }
        Insert: {
          author_id: string
          case_fingerprint: string
          created_at?: string
          docket_id?: string | null
          hearing_date?: string
          id?: string
          next_direction?: string | null
          note_for_next?: string | null
          updated_at?: string
          what_happened?: string | null
        }
        Update: {
          author_id?: string
          case_fingerprint?: string
          created_at?: string
          docket_id?: string | null
          hearing_date?: string
          id?: string
          next_direction?: string | null
          note_for_next?: string | null
          updated_at?: string
          what_happened?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_court_notes_docket_id_fkey"
            columns: ["docket_id"]
            isOneToOne: false
            referencedRelation: "daily_court_docket"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_scan_log: {
        Row: {
          aliases_searched: string[] | null
          id: string
          matches_found: number | null
          profile_id: string
          raw_causelist_id: string
          scanned_at: string | null
        }
        Insert: {
          aliases_searched?: string[] | null
          id?: string
          matches_found?: number | null
          profile_id: string
          raw_causelist_id: string
          scanned_at?: string | null
        }
        Update: {
          aliases_searched?: string[] | null
          id?: string
          matches_found?: number | null
          profile_id?: string
          raw_causelist_id?: string
          scanned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_scan_log_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_scan_log_raw_causelist_id_fkey"
            columns: ["raw_causelist_id"]
            isOneToOne: false
            referencedRelation: "raw_causelists"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          bar_registration_number: string | null
          bench: string | null
          created_at: string | null
          full_name: string | null
          id: string
          is_verified: boolean | null
          onboarding_completed: boolean | null
          role: string | null
          whatsapp_number: string | null
        }
        Insert: {
          bar_registration_number?: string | null
          bench?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          is_verified?: boolean | null
          onboarding_completed?: boolean | null
          role?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          bar_registration_number?: string | null
          bench?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          is_verified?: boolean | null
          onboarding_completed?: boolean | null
          role?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      raw_causelists: {
        Row: {
          bench: string
          created_at: string | null
          extraction_progress: Json | null
          file_name: string | null
          file_size_bytes: number | null
          id: string
          list_date: string
          list_type: string
          page_count: number | null
          status: string | null
          storage_path: string
          telegram_message_id: number | null
          text_content: string | null
        }
        Insert: {
          bench: string
          created_at?: string | null
          extraction_progress?: Json | null
          file_name?: string | null
          file_size_bytes?: number | null
          id?: string
          list_date: string
          list_type: string
          page_count?: number | null
          status?: string | null
          storage_path: string
          telegram_message_id?: number | null
          text_content?: string | null
        }
        Update: {
          bench?: string
          created_at?: string | null
          extraction_progress?: Json | null
          file_name?: string | null
          file_size_bytes?: number | null
          id?: string
          list_date?: string
          list_type?: string
          page_count?: number | null
          status?: string | null
          storage_path?: string
          telegram_message_id?: number | null
          text_content?: string | null
        }
        Relationships: []
      }
      scraper_logs: {
        Row: {
          bench: string
          cases_found: number | null
          court_no: string | null
          error_message: string | null
          id: string
          list_type: string | null
          run_at: string | null
          status: string
        }
        Insert: {
          bench: string
          cases_found?: number | null
          court_no?: string | null
          error_message?: string | null
          id?: string
          list_type?: string | null
          run_at?: string | null
          status: string
        }
        Update: {
          bench?: string
          cases_found?: number | null
          court_no?: string | null
          error_message?: string | null
          id?: string
          list_type?: string | null
          run_at?: string | null
          status?: string
        }
        Relationships: []
      }
      sync_status: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          last_source_timestamp: string | null
          last_sync_at: string
          source_name: string
          status: string | null
          sync_latency_ms: number | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_source_timestamp?: string | null
          last_sync_at?: string
          source_name: string
          status?: string | null
          sync_latency_ms?: number | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_source_timestamp?: string | null
          last_sync_at?: string
          source_name?: string
          status?: string | null
          sync_latency_ms?: number | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_case_fingerprint: {
        Args: {
          p_case_number: string
          p_court_location: string
          p_petitioner: string
          p_respondent: string
        }
        Returns: string
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "SENIOR" | "JUNIOR" | "CLERK" | "ADMIN"
      board_status: "hearing" | "passover" | "lunch" | "adjourned"
      document_format: "TYPED" | "SCANNED" | "HANDWRITTEN"
      document_language: "EN" | "HI" | "MIXED" | "UNKNOWN"
      document_legibility: "CLEAR" | "AVERAGE" | "POOR"
      document_type:
        | "CAUSELIST_PDF"
        | "PETITION"
        | "REPLY"
        | "REJOINDER"
        | "ORDER"
        | "ANNEXURES"
        | "NOTES"
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
      app_role: ["SENIOR", "JUNIOR", "CLERK", "ADMIN"],
      board_status: ["hearing", "passover", "lunch", "adjourned"],
      document_format: ["TYPED", "SCANNED", "HANDWRITTEN"],
      document_language: ["EN", "HI", "MIXED", "UNKNOWN"],
      document_legibility: ["CLEAR", "AVERAGE", "POOR"],
      document_type: [
        "CAUSELIST_PDF",
        "PETITION",
        "REPLY",
        "REJOINDER",
        "ORDER",
        "ANNEXURES",
        "NOTES",
      ],
    },
  },
} as const
