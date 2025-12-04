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
          file_url: string | null
          id: string
          uploaded_at: string | null
        }
        Insert: {
          doc_type?: string | null
          docket_id?: string | null
          file_url?: string | null
          id?: string
          uploaded_at?: string | null
        }
        Update: {
          doc_type?: string | null
          docket_id?: string | null
          file_url?: string | null
          id?: string
          uploaded_at?: string | null
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
      daily_court_docket: {
        Row: {
          case_number: string | null
          court_location: string | null
          court_room_no: string | null
          created_at: string | null
          date: string
          id: string
          item_no: number | null
          list_type: string | null
          matched_profile_id: string | null
          petitioner_lawyer: string | null
          respondent_lawyer: string | null
        }
        Insert: {
          case_number?: string | null
          court_location?: string | null
          court_room_no?: string | null
          created_at?: string | null
          date?: string
          id?: string
          item_no?: number | null
          list_type?: string | null
          matched_profile_id?: string | null
          petitioner_lawyer?: string | null
          respondent_lawyer?: string | null
        }
        Update: {
          case_number?: string | null
          court_location?: string | null
          court_room_no?: string | null
          created_at?: string | null
          date?: string
          id?: string
          item_no?: number | null
          list_type?: string | null
          matched_profile_id?: string | null
          petitioner_lawyer?: string | null
          respondent_lawyer?: string | null
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
      live_board_cache: {
        Row: {
          court_location: string
          court_no: string
          current_item: number | null
          is_supplementary_running: boolean | null
          last_updated: string | null
          status: string | null
        }
        Insert: {
          court_location: string
          court_no: string
          current_item?: number | null
          is_supplementary_running?: boolean | null
          last_updated?: string | null
          status?: string | null
        }
        Update: {
          court_location?: string
          court_no?: string
          current_item?: number | null
          is_supplementary_running?: boolean | null
          last_updated?: string | null
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
      profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string
          role: string | null
          whatsapp_number: string | null
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id: string
          role?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
          whatsapp_number?: string | null
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
    },
  },
} as const
