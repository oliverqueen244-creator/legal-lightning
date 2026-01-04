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
      admin_error_events: {
        Row: {
          admin_note: string | null
          app_version: string | null
          batch_id: string | null
          bench_code: string | null
          browser: string | null
          created_at: string
          device: string | null
          domain: Database["public"]["Enums"]["error_domain"]
          environment: Database["public"]["Enums"]["error_environment"]
          error_code: string
          id: string
          is_online: boolean | null
          message: string
          os: string | null
          resolved: boolean
          role: string | null
          route: string | null
          severity: Database["public"]["Enums"]["error_severity"]
          user_id: string | null
        }
        Insert: {
          admin_note?: string | null
          app_version?: string | null
          batch_id?: string | null
          bench_code?: string | null
          browser?: string | null
          created_at?: string
          device?: string | null
          domain?: Database["public"]["Enums"]["error_domain"]
          environment?: Database["public"]["Enums"]["error_environment"]
          error_code: string
          id?: string
          is_online?: boolean | null
          message: string
          os?: string | null
          resolved?: boolean
          role?: string | null
          route?: string | null
          severity?: Database["public"]["Enums"]["error_severity"]
          user_id?: string | null
        }
        Update: {
          admin_note?: string | null
          app_version?: string | null
          batch_id?: string | null
          bench_code?: string | null
          browser?: string | null
          created_at?: string
          device?: string | null
          domain?: Database["public"]["Enums"]["error_domain"]
          environment?: Database["public"]["Enums"]["error_environment"]
          error_code?: string
          id?: string
          is_online?: boolean | null
          message?: string
          os?: string | null
          resolved?: boolean
          role?: string | null
          route?: string | null
          severity?: Database["public"]["Enums"]["error_severity"]
          user_id?: string | null
        }
        Relationships: []
      }
      ai_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          job_type: string
          max_retries: number
          next_retry_at: string | null
          payload: Json
          priority: number
          provider: string | null
          result: Json | null
          retries: number
          started_at: string | null
          status: string
          tokens_used: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_type: string
          max_retries?: number
          next_retry_at?: string | null
          payload: Json
          priority?: number
          provider?: string | null
          result?: Json | null
          retries?: number
          started_at?: string | null
          status?: string
          tokens_used?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_type?: string
          max_retries?: number
          next_retry_at?: string | null
          payload?: Json
          priority?: number
          provider?: string | null
          result?: Json | null
          retries?: number
          started_at?: string | null
          status?: string
          tokens_used?: number | null
        }
        Relationships: []
      }
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
      audit_findings: {
        Row: {
          area: string
          audit_run_id: string
          created_at: string
          dimension: Database["public"]["Enums"]["audit_dimension"]
          id: string
          issue: string
          recommendation: string | null
          severity: Database["public"]["Enums"]["finding_severity"]
          status: Database["public"]["Enums"]["finding_status"]
          updated_at: string
          verified_feature: string | null
        }
        Insert: {
          area: string
          audit_run_id: string
          created_at?: string
          dimension: Database["public"]["Enums"]["audit_dimension"]
          id?: string
          issue: string
          recommendation?: string | null
          severity?: Database["public"]["Enums"]["finding_severity"]
          status?: Database["public"]["Enums"]["finding_status"]
          updated_at?: string
          verified_feature?: string | null
        }
        Update: {
          area?: string
          audit_run_id?: string
          created_at?: string
          dimension?: Database["public"]["Enums"]["audit_dimension"]
          id?: string
          issue?: string
          recommendation?: string | null
          severity?: Database["public"]["Enums"]["finding_severity"]
          status?: Database["public"]["Enums"]["finding_status"]
          updated_at?: string
          verified_feature?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_findings_audit_run_id_fkey"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_risks: {
        Row: {
          audit_run_id: string
          created_at: string
          description: string
          id: string
          impact: string
          mitigation: string | null
          risk_type: Database["public"]["Enums"]["risk_type"]
          severity: Database["public"]["Enums"]["finding_severity"]
        }
        Insert: {
          audit_run_id: string
          created_at?: string
          description: string
          id?: string
          impact: string
          mitigation?: string | null
          risk_type: Database["public"]["Enums"]["risk_type"]
          severity?: Database["public"]["Enums"]["finding_severity"]
        }
        Update: {
          audit_run_id?: string
          created_at?: string
          description?: string
          id?: string
          impact?: string
          mitigation?: string | null
          risk_type?: Database["public"]["Enums"]["risk_type"]
          severity?: Database["public"]["Enums"]["finding_severity"]
        }
        Relationships: [
          {
            foreignKeyName: "audit_risks_audit_run_id_fkey"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_runs: {
        Row: {
          audit_name: string
          audit_scope: Database["public"]["Enums"]["audit_scope"]
          completed_at: string | null
          conducted_by: string
          created_at: string
          go_decision: Database["public"]["Enums"]["go_decision"] | null
          go_justification: string | null
          id: string
          notes: string | null
          overall_status: Database["public"]["Enums"]["audit_status"] | null
          started_at: string
        }
        Insert: {
          audit_name: string
          audit_scope?: Database["public"]["Enums"]["audit_scope"]
          completed_at?: string | null
          conducted_by: string
          created_at?: string
          go_decision?: Database["public"]["Enums"]["go_decision"] | null
          go_justification?: string | null
          id?: string
          notes?: string | null
          overall_status?: Database["public"]["Enums"]["audit_status"] | null
          started_at?: string
        }
        Update: {
          audit_name?: string
          audit_scope?: Database["public"]["Enums"]["audit_scope"]
          completed_at?: string | null
          conducted_by?: string
          created_at?: string
          go_decision?: Database["public"]["Enums"]["go_decision"] | null
          go_justification?: string | null
          id?: string
          notes?: string | null
          overall_status?: Database["public"]["Enums"]["audit_status"] | null
          started_at?: string
        }
        Relationships: []
      }
      bench_procedural_patterns: {
        Row: {
          avg_lunch_duration_minutes: number | null
          avg_start_time: string | null
          bench: string
          court_no: string
          created_at: string
          id: string
          observations_count: number
          pattern_date: string
          typical_items_per_hour: number | null
        }
        Insert: {
          avg_lunch_duration_minutes?: number | null
          avg_start_time?: string | null
          bench: string
          court_no: string
          created_at?: string
          id?: string
          observations_count?: number
          pattern_date?: string
          typical_items_per_hour?: number | null
        }
        Update: {
          avg_lunch_duration_minutes?: number | null
          avg_start_time?: string | null
          bench?: string
          court_no?: string
          created_at?: string
          id?: string
          observations_count?: number
          pattern_date?: string
          typical_items_per_hour?: number | null
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
          {
            foreignKeyName: "case_arguments_docket_id_fkey"
            columns: ["docket_id"]
            isOneToOne: false
            referencedRelation: "user_docket_view"
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
          {
            foreignKeyName: "case_documents_docket_id_fkey"
            columns: ["docket_id"]
            isOneToOne: false
            referencedRelation: "user_docket_view"
            referencedColumns: ["id"]
          },
        ]
      }
      case_parse_queue: {
        Row: {
          batch_start: number | null
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
          batch_start?: number | null
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
          batch_start?: number | null
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
      chamber_invites: {
        Row: {
          chamber_id: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          invite_code: string
          invited_email: string | null
          role_in_chamber: Database["public"]["Enums"]["chamber_role"]
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          chamber_id: string
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          invite_code?: string
          invited_email?: string | null
          role_in_chamber?: Database["public"]["Enums"]["chamber_role"]
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          chamber_id?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          invite_code?: string
          invited_email?: string | null
          role_in_chamber?: Database["public"]["Enums"]["chamber_role"]
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chamber_invites_chamber_id_fkey"
            columns: ["chamber_id"]
            isOneToOne: false
            referencedRelation: "chambers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamber_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamber_invites_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chamber_memberships: {
        Row: {
          chamber_id: string
          id: string
          invited_by: string | null
          joined_at: string
          lawyer_id: string
          revoked_at: string | null
          role_in_chamber: Database["public"]["Enums"]["chamber_role"]
        }
        Insert: {
          chamber_id: string
          id?: string
          invited_by?: string | null
          joined_at?: string
          lawyer_id: string
          revoked_at?: string | null
          role_in_chamber?: Database["public"]["Enums"]["chamber_role"]
        }
        Update: {
          chamber_id?: string
          id?: string
          invited_by?: string | null
          joined_at?: string
          lawyer_id?: string
          revoked_at?: string | null
          role_in_chamber?: Database["public"]["Enums"]["chamber_role"]
        }
        Relationships: [
          {
            foreignKeyName: "chamber_memberships_chamber_id_fkey"
            columns: ["chamber_id"]
            isOneToOne: false
            referencedRelation: "chambers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamber_memberships_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamber_memberships_lawyer_id_fkey"
            columns: ["lawyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chambers: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chambers_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      court_mode_settings: {
        Row: {
          court_mode_bench: string | null
          court_mode_enabled: boolean
          court_mode_end: string
          court_mode_start: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
          whatsapp_escalation_enabled: boolean
        }
        Insert: {
          court_mode_bench?: string | null
          court_mode_enabled?: boolean
          court_mode_end?: string
          court_mode_start?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          whatsapp_escalation_enabled?: boolean
        }
        Update: {
          court_mode_bench?: string | null
          court_mode_enabled?: boolean
          court_mode_end?: string
          court_mode_start?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          whatsapp_escalation_enabled?: boolean
        }
        Relationships: []
      }
      court_overrides: {
        Row: {
          court_location: string
          court_no: string
          created_at: string
          expires_at: string | null
          from_serial: number | null
          id: string
          is_active: boolean
          new_judge: string | null
          override_date: string
          override_type: string
          source_causelist_id: string | null
          to_serial: number | null
        }
        Insert: {
          court_location: string
          court_no: string
          created_at?: string
          expires_at?: string | null
          from_serial?: number | null
          id?: string
          is_active?: boolean
          new_judge?: string | null
          override_date?: string
          override_type?: string
          source_causelist_id?: string | null
          to_serial?: number | null
        }
        Update: {
          court_location?: string
          court_no?: string
          created_at?: string
          expires_at?: string | null
          from_serial?: number | null
          id?: string
          is_active?: boolean
          new_judge?: string | null
          override_date?: string
          override_type?: string
          source_causelist_id?: string | null
          to_serial?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "court_overrides_source_causelist_id_fkey"
            columns: ["source_causelist_id"]
            isOneToOne: false
            referencedRelation: "raw_causelists"
            referencedColumns: ["id"]
          },
        ]
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
          match_confidence: number | null
          match_method: string | null
          matched_profile_id: string | null
          matched_role: string | null
          needs_review: boolean | null
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
          match_confidence?: number | null
          match_method?: string | null
          matched_profile_id?: string | null
          matched_role?: string | null
          needs_review?: boolean | null
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
          match_confidence?: number | null
          match_method?: string | null
          matched_profile_id?: string | null
          matched_role?: string | null
          needs_review?: boolean | null
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
      docket_cleanup_log: {
        Row: {
          case_number: string | null
          cleaned_at: string
          court_location: string | null
          court_room_no: string | null
          date: string
          deleted_docket_id: string
          id: string
          original_created_at: string | null
          reason: string
        }
        Insert: {
          case_number?: string | null
          cleaned_at?: string
          court_location?: string | null
          court_room_no?: string | null
          date: string
          deleted_docket_id: string
          id?: string
          original_created_at?: string | null
          reason: string
        }
        Update: {
          case_number?: string | null
          cleaned_at?: string
          court_location?: string | null
          court_room_no?: string | null
          date?: string
          deleted_docket_id?: string
          id?: string
          original_created_at?: string | null
          reason?: string
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
      fallback_disabled_benches: {
        Row: {
          bench_code: string
          disabled_at: string
          disabled_by: string | null
          reason: string | null
        }
        Insert: {
          bench_code: string
          disabled_at?: string
          disabled_by?: string | null
          reason?: string | null
        }
        Update: {
          bench_code?: string
          disabled_at?: string
          disabled_by?: string | null
          reason?: string | null
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
      judge_observation_sharing: {
        Row: {
          chamber_id: string
          chamber_uuid: string | null
          consented_at: string
          id: string
          lawyer_id: string
          revoked_at: string | null
          share_own_observations: boolean
          view_chamber_observations: boolean
        }
        Insert: {
          chamber_id: string
          chamber_uuid?: string | null
          consented_at?: string
          id?: string
          lawyer_id: string
          revoked_at?: string | null
          share_own_observations?: boolean
          view_chamber_observations?: boolean
        }
        Update: {
          chamber_id?: string
          chamber_uuid?: string | null
          consented_at?: string
          id?: string
          lawyer_id?: string
          revoked_at?: string | null
          share_own_observations?: boolean
          view_chamber_observations?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "judge_observation_sharing_chamber_uuid_fkey"
            columns: ["chamber_uuid"]
            isOneToOne: false
            referencedRelation: "chambers"
            referencedColumns: ["id"]
          },
        ]
      }
      judge_observations: {
        Row: {
          bench: string
          court_no: string | null
          created_at: string
          hearing_date: string | null
          id: string
          judge_name: string
          lawyer_id: string
          observation_text: string
          observation_type: string
          source_case_number: string | null
          source_docket_id: string | null
        }
        Insert: {
          bench: string
          court_no?: string | null
          created_at?: string
          hearing_date?: string | null
          id?: string
          judge_name: string
          lawyer_id: string
          observation_text: string
          observation_type?: string
          source_case_number?: string | null
          source_docket_id?: string | null
        }
        Update: {
          bench?: string
          court_no?: string | null
          created_at?: string
          hearing_date?: string | null
          id?: string
          judge_name?: string
          lawyer_id?: string
          observation_text?: string
          observation_type?: string
          source_case_number?: string | null
          source_docket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "judge_observations_source_docket_id_fkey"
            columns: ["source_docket_id"]
            isOneToOne: false
            referencedRelation: "daily_court_docket"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "judge_observations_source_docket_id_fkey"
            columns: ["source_docket_id"]
            isOneToOne: false
            referencedRelation: "user_docket_view"
            referencedColumns: ["id"]
          },
        ]
      }
      judgment_attachments: {
        Row: {
          argument_id: string | null
          attached_at: string
          attached_by: string
          docket_id: string | null
          id: string
          judgment_court: string | null
          judgment_date: string | null
          judgment_title: string
          judgment_url: string
          priority_signals: string[] | null
          ranking_score: number | null
          ranking_signals: Json | null
          search_vector: string | null
          source: string
          user_note: string | null
        }
        Insert: {
          argument_id?: string | null
          attached_at?: string
          attached_by: string
          docket_id?: string | null
          id?: string
          judgment_court?: string | null
          judgment_date?: string | null
          judgment_title: string
          judgment_url: string
          priority_signals?: string[] | null
          ranking_score?: number | null
          ranking_signals?: Json | null
          search_vector?: string | null
          source?: string
          user_note?: string | null
        }
        Update: {
          argument_id?: string | null
          attached_at?: string
          attached_by?: string
          docket_id?: string | null
          id?: string
          judgment_court?: string | null
          judgment_date?: string | null
          judgment_title?: string
          judgment_url?: string
          priority_signals?: string[] | null
          ranking_score?: number | null
          ranking_signals?: Json | null
          search_vector?: string | null
          source?: string
          user_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "judgment_attachments_argument_id_fkey"
            columns: ["argument_id"]
            isOneToOne: false
            referencedRelation: "case_arguments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "judgment_attachments_docket_id_fkey"
            columns: ["docket_id"]
            isOneToOne: false
            referencedRelation: "daily_court_docket"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "judgment_attachments_docket_id_fkey"
            columns: ["docket_id"]
            isOneToOne: false
            referencedRelation: "user_docket_view"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "live_courtroom_feed_docket_id_fkey"
            columns: ["docket_id"]
            isOneToOne: false
            referencedRelation: "user_docket_view"
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
      notification_escalations: {
        Row: {
          attempted_at: string
          case_fingerprint: string | null
          channel: string
          error_message: string | null
          escalation_date: string
          id: string
          notification_id: string
          status: string
          user_id: string
        }
        Insert: {
          attempted_at?: string
          case_fingerprint?: string | null
          channel: string
          error_message?: string | null
          escalation_date?: string
          id?: string
          notification_id: string
          status: string
          user_id: string
        }
        Update: {
          attempted_at?: string
          case_fingerprint?: string | null
          channel?: string
          error_message?: string | null
          escalation_date?: string
          id?: string
          notification_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_escalations_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          acknowledged_at: string | null
          created_at: string
          docket_id: string | null
          id: string
          item_distance: number | null
          message: string
          notification_type: string
          severity: string
          status: string
          threshold_crossed: string | null
          title: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string
          docket_id?: string | null
          id?: string
          item_distance?: number | null
          message: string
          notification_type: string
          severity: string
          status?: string
          threshold_crossed?: string | null
          title: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string
          docket_id?: string | null
          id?: string
          item_distance?: number | null
          message?: string
          notification_type?: string
          severity?: string
          status?: string
          threshold_crossed?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_docket_id_fkey"
            columns: ["docket_id"]
            isOneToOne: false
            referencedRelation: "daily_court_docket"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_docket_id_fkey"
            columns: ["docket_id"]
            isOneToOne: false
            referencedRelation: "user_docket_view"
            referencedColumns: ["id"]
          },
        ]
      }
      parser_confidence_runs: {
        Row: {
          batch_id: string | null
          bench_code: string
          confidence_level: Database["public"]["Enums"]["confidence_level"]
          confidence_reasons: Json
          confidence_score: number
          created_at: string
          historical_consistency_score: number | null
          id: string
          ingestion_error_count: number
          ingestion_integrity_score: number | null
          matching_error_count: number
          matching_reliability_score: number | null
          parse_mode: string | null
          parsing_error_count: number
          parsing_stability_score: number | null
          run_date: string
          total_cases_detected: number
          total_cases_matched: number
          total_cases_parsed: number
          warning_issued: boolean
        }
        Insert: {
          batch_id?: string | null
          bench_code: string
          confidence_level?: Database["public"]["Enums"]["confidence_level"]
          confidence_reasons?: Json
          confidence_score?: number
          created_at?: string
          historical_consistency_score?: number | null
          id?: string
          ingestion_error_count?: number
          ingestion_integrity_score?: number | null
          matching_error_count?: number
          matching_reliability_score?: number | null
          parse_mode?: string | null
          parsing_error_count?: number
          parsing_stability_score?: number | null
          run_date?: string
          total_cases_detected?: number
          total_cases_matched?: number
          total_cases_parsed?: number
          warning_issued?: boolean
        }
        Update: {
          batch_id?: string | null
          bench_code?: string
          confidence_level?: Database["public"]["Enums"]["confidence_level"]
          confidence_reasons?: Json
          confidence_score?: number
          created_at?: string
          historical_consistency_score?: number | null
          id?: string
          ingestion_error_count?: number
          ingestion_integrity_score?: number | null
          matching_error_count?: number
          matching_reliability_score?: number | null
          parse_mode?: string | null
          parsing_error_count?: number
          parsing_stability_score?: number | null
          run_date?: string
          total_cases_detected?: number
          total_cases_matched?: number
          total_cases_parsed?: number
          warning_issued?: boolean
        }
        Relationships: []
      }
      parser_fallback_log: {
        Row: {
          applied_at: string
          batch_id: string
          bench_code: string
          cases_after: number
          cases_before: number
          confidence_after: number
          confidence_before: number
          created_at: string
          fallback_level: Database["public"]["Enums"]["fallback_level"]
          id: string
          parse_duration_ms: number | null
          triggered_reason: string
        }
        Insert: {
          applied_at?: string
          batch_id: string
          bench_code: string
          cases_after?: number
          cases_before?: number
          confidence_after?: number
          confidence_before?: number
          created_at?: string
          fallback_level: Database["public"]["Enums"]["fallback_level"]
          id?: string
          parse_duration_ms?: number | null
          triggered_reason: string
        }
        Update: {
          applied_at?: string
          batch_id?: string
          bench_code?: string
          cases_after?: number
          cases_before?: number
          confidence_after?: number
          confidence_before?: number
          created_at?: string
          fallback_level?: Database["public"]["Enums"]["fallback_level"]
          id?: string
          parse_duration_ms?: number | null
          triggered_reason?: string
        }
        Relationships: []
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
          {
            foreignKeyName: "post_court_notes_docket_id_fkey"
            columns: ["docket_id"]
            isOneToOne: false
            referencedRelation: "user_docket_view"
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
          source: string | null
          status: string | null
          storage_path: string
          telegram_message_id: number | null
          text_content: string | null
          uploaded_by: string | null
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
          source?: string | null
          status?: string | null
          storage_path: string
          telegram_message_id?: number | null
          text_content?: string | null
          uploaded_by?: string | null
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
          source?: string | null
          status?: string | null
          storage_path?: string
          telegram_message_id?: number | null
          text_content?: string | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      raw_causelists_archive: {
        Row: {
          archived_at: string | null
          bench: string
          id: string
          list_date: string
          list_type: string
          text_content: string | null
        }
        Insert: {
          archived_at?: string | null
          bench: string
          id: string
          list_date: string
          list_type: string
          text_content?: string | null
        }
        Update: {
          archived_at?: string | null
          bench?: string
          id?: string
          list_date?: string
          list_type?: string
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
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_type: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_type?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_type?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
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
      token_usage_daily: {
        Row: {
          budget_limit: number | null
          created_at: string | null
          id: string
          job_count: number
          provider: string
          tokens_used: number
          updated_at: string | null
          usage_date: string
        }
        Insert: {
          budget_limit?: number | null
          created_at?: string | null
          id?: string
          job_count?: number
          provider: string
          tokens_used?: number
          updated_at?: string | null
          usage_date?: string
        }
        Update: {
          budget_limit?: number | null
          created_at?: string | null
          id?: string
          job_count?: number
          provider?: string
          tokens_used?: number
          updated_at?: string | null
          usage_date?: string
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
      fallback_summary_view: {
        Row: {
          attempt_count: number | null
          avg_confidence_delta: number | null
          bench_code: string | null
          fallback_date: string | null
          fallback_level: Database["public"]["Enums"]["fallback_level"] | null
          improvement_count: number | null
          last_attempt: string | null
          total_cases_recovered: number | null
        }
        Relationships: []
      }
      parsing_health_summary: {
        Row: {
          affected_batches: number | null
          affected_benches: number | null
          domain: Database["public"]["Enums"]["error_domain"] | null
          error_code: string | null
          error_count: number | null
          last_seen: string | null
          report_date: string | null
          resolved_count: number | null
          severity: Database["public"]["Enums"]["error_severity"] | null
        }
        Relationships: []
      }
      user_docket_view: {
        Row: {
          case_number: string | null
          court_location: string | null
          court_room_no: string | null
          created_at: string | null
          date: string | null
          force_active: boolean | null
          id: string | null
          item_no: number | null
          judge_names: string | null
          list_type: string | null
          matched_profile_id: string | null
          petitioner: string | null
          petitioner_lawyer: string | null
          respondent: string | null
          respondent_lawyer: string | null
          status: string | null
        }
        Insert: {
          case_number?: string | null
          court_location?: string | null
          court_room_no?: string | null
          created_at?: string | null
          date?: string | null
          force_active?: boolean | null
          id?: string | null
          item_no?: number | null
          judge_names?: string | null
          list_type?: string | null
          matched_profile_id?: string | null
          petitioner?: string | null
          petitioner_lawyer?: string | null
          respondent?: string | null
          respondent_lawyer?: string | null
          status?: string | null
        }
        Update: {
          case_number?: string | null
          court_location?: string | null
          court_room_no?: string | null
          created_at?: string | null
          date?: string | null
          force_active?: boolean | null
          id?: string | null
          item_no?: number | null
          judge_names?: string | null
          list_type?: string | null
          matched_profile_id?: string | null
          petitioner?: string | null
          petitioner_lawyer?: string | null
          respondent?: string | null
          respondent_lawyer?: string | null
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
    }
    Functions: {
      archive_old_causelists: { Args: never; Returns: number }
      cleanup_old_scraper_logs: { Args: never; Returns: number }
      generate_case_fingerprint: {
        Args: {
          p_case_number: string
          p_court_location: string
          p_petitioner: string
          p_respondent: string
        }
        Returns: string
      }
      get_active_confidence_warnings: {
        Args: never
        Returns: {
          bench_code: string
          confidence_level: Database["public"]["Enums"]["confidence_level"]
          run_date: string
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_active_subscription: { Args: { p_user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_fallback_disabled: { Args: { p_bench_code: string }; Returns: boolean }
      log_error_event: {
        Args: {
          p_app_version?: string
          p_batch_id?: string
          p_bench_code?: string
          p_browser?: string
          p_device?: string
          p_domain: Database["public"]["Enums"]["error_domain"]
          p_environment?: Database["public"]["Enums"]["error_environment"]
          p_error_code: string
          p_is_online?: boolean
          p_message: string
          p_os?: string
          p_role?: string
          p_route?: string
          p_severity: Database["public"]["Enums"]["error_severity"]
          p_user_id?: string
        }
        Returns: string
      }
      log_fallback_attempt: {
        Args: {
          p_batch_id: string
          p_bench_code: string
          p_cases_after: number
          p_cases_before: number
          p_confidence_after: number
          p_confidence_before: number
          p_fallback_level: string
          p_parse_duration_ms?: number
          p_triggered_reason: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "SENIOR" | "JUNIOR" | "CLERK" | "ADMIN"
      audit_dimension:
        | "user_experience"
        | "role_permissions"
        | "product_coherence"
        | "system_failure"
        | "operator_readiness"
        | "business_liability"
      audit_scope: "release" | "feature" | "full-system"
      audit_status: "pass" | "conditional" | "fail"
      board_status: "hearing" | "passover" | "lunch" | "adjourned"
      chamber_role: "senior" | "junior" | "clerk"
      confidence_level: "excellent" | "good" | "degraded" | "risky" | "unsafe"
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
      error_domain:
        | "AUTH"
        | "NETWORK"
        | "OFFLINE_BLOCK"
        | "SYNC"
        | "UPLOAD"
        | "PWA"
        | "REALTIME"
        | "CAUSELIST_PARSING"
        | "CASE_MATCHING"
        | "INGESTION"
        | "UNKNOWN"
      error_environment: "web" | "pwa" | "ios" | "backend"
      error_severity: "P0" | "P1" | "P2"
      fallback_level:
        | "primary"
        | "fallback_1_lenient"
        | "fallback_2_section"
        | "fallback_3_historical"
      finding_severity: "low" | "medium" | "high" | "critical"
      finding_status: "open" | "acknowledged" | "fixed"
      go_decision: "go" | "conditional_go" | "no_go"
      risk_type: "ux" | "trust" | "operational" | "legal" | "scale"
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
      audit_dimension: [
        "user_experience",
        "role_permissions",
        "product_coherence",
        "system_failure",
        "operator_readiness",
        "business_liability",
      ],
      audit_scope: ["release", "feature", "full-system"],
      audit_status: ["pass", "conditional", "fail"],
      board_status: ["hearing", "passover", "lunch", "adjourned"],
      chamber_role: ["senior", "junior", "clerk"],
      confidence_level: ["excellent", "good", "degraded", "risky", "unsafe"],
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
      error_domain: [
        "AUTH",
        "NETWORK",
        "OFFLINE_BLOCK",
        "SYNC",
        "UPLOAD",
        "PWA",
        "REALTIME",
        "CAUSELIST_PARSING",
        "CASE_MATCHING",
        "INGESTION",
        "UNKNOWN",
      ],
      error_environment: ["web", "pwa", "ios", "backend"],
      error_severity: ["P0", "P1", "P2"],
      fallback_level: [
        "primary",
        "fallback_1_lenient",
        "fallback_2_section",
        "fallback_3_historical",
      ],
      finding_severity: ["low", "medium", "high", "critical"],
      finding_status: ["open", "acknowledged", "fixed"],
      go_decision: ["go", "conditional_go", "no_go"],
      risk_type: ["ux", "trust", "operational", "legal", "scale"],
    },
  },
} as const
