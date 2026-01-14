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
      app_config: {
        Row: {
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: Json
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
      captcha_queue: {
        Row: {
          captcha_image_base64: string | null
          captcha_image_url: string | null
          created_at: string
          expires_at: string
          id: string
          job_id: string
          solution: string | null
          solved_at: string | null
          solved_by: string | null
          status: string
        }
        Insert: {
          captcha_image_base64?: string | null
          captcha_image_url?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          job_id: string
          solution?: string | null
          solved_at?: string | null
          solved_by?: string | null
          status?: string
        }
        Update: {
          captcha_image_base64?: string | null
          captcha_image_url?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          job_id?: string
          solution?: string | null
          solved_at?: string | null
          solved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "captcha_queue_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "order_fetch_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captcha_queue_solved_by_fkey"
            columns: ["solved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      captcha_usage_log: {
        Row: {
          captcha_type: string | null
          cost_credits: number | null
          created_at: string | null
          error_reason: string | null
          id: string
          lawyer_id: string
          provider: string
          solve_time_ms: number | null
          solved_at: string | null
          success: boolean
          tracked_case_id: string | null
        }
        Insert: {
          captcha_type?: string | null
          cost_credits?: number | null
          created_at?: string | null
          error_reason?: string | null
          id?: string
          lawyer_id: string
          provider?: string
          solve_time_ms?: number | null
          solved_at?: string | null
          success: boolean
          tracked_case_id?: string | null
        }
        Update: {
          captcha_type?: string | null
          cost_credits?: number | null
          created_at?: string | null
          error_reason?: string | null
          id?: string
          lawyer_id?: string
          provider?: string
          solve_time_ms?: number | null
          solved_at?: string | null
          success?: boolean
          tracked_case_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "captcha_usage_log_lawyer_id_fkey"
            columns: ["lawyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captcha_usage_log_tracked_case_id_fkey"
            columns: ["tracked_case_id"]
            isOneToOne: false
            referencedRelation: "tracked_cases"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "case_arguments_docket_id_fkey"
            columns: ["docket_id"]
            isOneToOne: false
            referencedRelation: "v_clerk_ownership_violations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_arguments_docket_id_fkey"
            columns: ["docket_id"]
            isOneToOne: false
            referencedRelation: "v_invalid_case_contexts"
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
          {
            foreignKeyName: "case_documents_docket_id_fkey"
            columns: ["docket_id"]
            isOneToOne: false
            referencedRelation: "v_clerk_ownership_violations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_documents_docket_id_fkey"
            columns: ["docket_id"]
            isOneToOne: false
            referencedRelation: "v_invalid_case_contexts"
            referencedColumns: ["id"]
          },
        ]
      }
      case_export_logs: {
        Row: {
          cases_exported: number
          date_range_end: string | null
          date_range_start: string | null
          export_format: string
          export_type: string
          exported_at: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          cases_exported?: number
          date_range_end?: string | null
          date_range_start?: string | null
          export_format: string
          export_type: string
          exported_at?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          cases_exported?: number
          date_range_end?: string | null
          date_range_start?: string | null
          export_format?: string
          export_type?: string
          exported_at?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      case_hearings: {
        Row: {
          case_fingerprint: string
          court_room_no: string | null
          created_at: string
          created_by: string
          hearing_date: string
          id: string
          judge_names: string | null
          outcome: string | null
          source: Database["public"]["Enums"]["hearing_source"]
          source_post_court_note_id: string | null
          updated_at: string
          was_heard: boolean
        }
        Insert: {
          case_fingerprint: string
          court_room_no?: string | null
          created_at?: string
          created_by: string
          hearing_date: string
          id?: string
          judge_names?: string | null
          outcome?: string | null
          source?: Database["public"]["Enums"]["hearing_source"]
          source_post_court_note_id?: string | null
          updated_at?: string
          was_heard?: boolean
        }
        Update: {
          case_fingerprint?: string
          court_room_no?: string | null
          created_at?: string
          created_by?: string
          hearing_date?: string
          id?: string
          judge_names?: string | null
          outcome?: string | null
          source?: Database["public"]["Enums"]["hearing_source"]
          source_post_court_note_id?: string | null
          updated_at?: string
          was_heard?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "case_hearings_source_post_court_note_id_fkey"
            columns: ["source_post_court_note_id"]
            isOneToOne: false
            referencedRelation: "post_court_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      case_judgments: {
        Row: {
          created_at: string | null
          fetched_at: string | null
          id: string
          judgment_date: string
          lawyer_id: string
          pdf_hash: string | null
          pdf_size_bytes: number | null
          source_pdf_url: string | null
          stored_pdf_path: string | null
          tracked_case_id: string
        }
        Insert: {
          created_at?: string | null
          fetched_at?: string | null
          id?: string
          judgment_date: string
          lawyer_id: string
          pdf_hash?: string | null
          pdf_size_bytes?: number | null
          source_pdf_url?: string | null
          stored_pdf_path?: string | null
          tracked_case_id: string
        }
        Update: {
          created_at?: string | null
          fetched_at?: string | null
          id?: string
          judgment_date?: string
          lawyer_id?: string
          pdf_hash?: string | null
          pdf_size_bytes?: number | null
          source_pdf_url?: string | null
          stored_pdf_path?: string | null
          tracked_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_judgments_lawyer_id_fkey"
            columns: ["lawyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_judgments_tracked_case_id_fkey"
            columns: ["tracked_case_id"]
            isOneToOne: true
            referencedRelation: "tracked_cases"
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
      causelist_gap_audit: {
        Row: {
          actual_items: number
          court_no: string
          coverage_percent: number
          detected_at: string
          expected_items: number
          id: string
          missing_ranges: Json | null
          raw_causelist_id: string
        }
        Insert: {
          actual_items: number
          court_no: string
          coverage_percent: number
          detected_at?: string
          expected_items: number
          id?: string
          missing_ranges?: Json | null
          raw_causelist_id: string
        }
        Update: {
          actual_items?: number
          court_no?: string
          coverage_percent?: number
          detected_at?: string
          expected_items?: number
          id?: string
          missing_ranges?: Json | null
          raw_causelist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "causelist_gap_audit_raw_causelist_id_fkey"
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
      clerk_delegations: {
        Row: {
          chamber_id: string | null
          clerk_id: string
          created_by: string | null
          delegated_at: string
          id: string
          lawyer_id: string
          revoked_at: string | null
          scopes: Database["public"]["Enums"]["delegation_scope"][]
        }
        Insert: {
          chamber_id?: string | null
          clerk_id: string
          created_by?: string | null
          delegated_at?: string
          id?: string
          lawyer_id: string
          revoked_at?: string | null
          scopes?: Database["public"]["Enums"]["delegation_scope"][]
        }
        Update: {
          chamber_id?: string | null
          clerk_id?: string
          created_by?: string | null
          delegated_at?: string
          id?: string
          lawyer_id?: string
          revoked_at?: string | null
          scopes?: Database["public"]["Enums"]["delegation_scope"][]
        }
        Relationships: [
          {
            foreignKeyName: "clerk_delegations_chamber_id_fkey"
            columns: ["chamber_id"]
            isOneToOne: false
            referencedRelation: "chambers"
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
      court_orders: {
        Row: {
          bench: Database["public"]["Enums"]["rhc_bench"]
          created_at: string
          fetch_trigger: Database["public"]["Enums"]["order_fetch_trigger"]
          fetched_at: string
          id: string
          order_date: string
          order_type: string | null
          pdf_hash: string | null
          pdf_size_bytes: number | null
          source_pdf_url: string | null
          stored_pdf_path: string | null
          tracked_case_id: string
        }
        Insert: {
          bench: Database["public"]["Enums"]["rhc_bench"]
          created_at?: string
          fetch_trigger: Database["public"]["Enums"]["order_fetch_trigger"]
          fetched_at?: string
          id?: string
          order_date: string
          order_type?: string | null
          pdf_hash?: string | null
          pdf_size_bytes?: number | null
          source_pdf_url?: string | null
          stored_pdf_path?: string | null
          tracked_case_id: string
        }
        Update: {
          bench?: Database["public"]["Enums"]["rhc_bench"]
          created_at?: string
          fetch_trigger?: Database["public"]["Enums"]["order_fetch_trigger"]
          fetched_at?: string
          id?: string
          order_date?: string
          order_type?: string | null
          pdf_hash?: string | null
          pdf_size_bytes?: number | null
          source_pdf_url?: string | null
          stored_pdf_path?: string | null
          tracked_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "court_orders_tracked_case_id_fkey"
            columns: ["tracked_case_id"]
            isOneToOne: false
            referencedRelation: "tracked_cases"
            referencedColumns: ["id"]
          },
        ]
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
          case_context: Database["public"]["Enums"]["case_context"]
          case_fingerprint: string | null
          case_number: string | null
          case_title_raw: string | null
          chamber_id: string | null
          confidence_source: string | null
          court_location: string | null
          court_room_no: string | null
          created_at: string | null
          date: string
          fingerprint_matched_at: string | null
          force_active: boolean | null
          hearing_likelihood:
            | Database["public"]["Enums"]["hearing_likelihood"]
            | null
          id: string
          item_no: number | null
          judge_names: string | null
          likelihood_derived_at: string | null
          likelihood_reason: string | null
          list_type: string | null
          match_confidence: number | null
          match_method: string | null
          matched_profile_id: string | null
          matched_role: string | null
          needs_review: boolean | null
          origin: string | null
          petitioner: string | null
          petitioner_lawyer: string | null
          raw_causelist_id: string | null
          respondent: string | null
          respondent_lawyer: string | null
          source_url: string | null
          status: string | null
          structure_confidence: number | null
          vc_confidence: number | null
          vc_extracted_at: string | null
          vc_join_url: string | null
          vc_meeting_id: string | null
          vc_provider: Database["public"]["Enums"]["vc_provider"] | null
          vc_source: string | null
        }
        Insert: {
          case_context?: Database["public"]["Enums"]["case_context"]
          case_fingerprint?: string | null
          case_number?: string | null
          case_title_raw?: string | null
          chamber_id?: string | null
          confidence_source?: string | null
          court_location?: string | null
          court_room_no?: string | null
          created_at?: string | null
          date?: string
          fingerprint_matched_at?: string | null
          force_active?: boolean | null
          hearing_likelihood?:
            | Database["public"]["Enums"]["hearing_likelihood"]
            | null
          id?: string
          item_no?: number | null
          judge_names?: string | null
          likelihood_derived_at?: string | null
          likelihood_reason?: string | null
          list_type?: string | null
          match_confidence?: number | null
          match_method?: string | null
          matched_profile_id?: string | null
          matched_role?: string | null
          needs_review?: boolean | null
          origin?: string | null
          petitioner?: string | null
          petitioner_lawyer?: string | null
          raw_causelist_id?: string | null
          respondent?: string | null
          respondent_lawyer?: string | null
          source_url?: string | null
          status?: string | null
          structure_confidence?: number | null
          vc_confidence?: number | null
          vc_extracted_at?: string | null
          vc_join_url?: string | null
          vc_meeting_id?: string | null
          vc_provider?: Database["public"]["Enums"]["vc_provider"] | null
          vc_source?: string | null
        }
        Update: {
          case_context?: Database["public"]["Enums"]["case_context"]
          case_fingerprint?: string | null
          case_number?: string | null
          case_title_raw?: string | null
          chamber_id?: string | null
          confidence_source?: string | null
          court_location?: string | null
          court_room_no?: string | null
          created_at?: string | null
          date?: string
          fingerprint_matched_at?: string | null
          force_active?: boolean | null
          hearing_likelihood?:
            | Database["public"]["Enums"]["hearing_likelihood"]
            | null
          id?: string
          item_no?: number | null
          judge_names?: string | null
          likelihood_derived_at?: string | null
          likelihood_reason?: string | null
          list_type?: string | null
          match_confidence?: number | null
          match_method?: string | null
          matched_profile_id?: string | null
          matched_role?: string | null
          needs_review?: boolean | null
          origin?: string | null
          petitioner?: string | null
          petitioner_lawyer?: string | null
          raw_causelist_id?: string | null
          respondent?: string | null
          respondent_lawyer?: string | null
          source_url?: string | null
          status?: string | null
          structure_confidence?: number | null
          vc_confidence?: number | null
          vc_extracted_at?: string | null
          vc_join_url?: string | null
          vc_meeting_id?: string | null
          vc_provider?: Database["public"]["Enums"]["vc_provider"] | null
          vc_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_court_docket_chamber_id_fkey"
            columns: ["chamber_id"]
            isOneToOne: false
            referencedRelation: "chambers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_court_docket_matched_profile_id_fkey"
            columns: ["matched_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_execution_policies: {
        Row: {
          authority_level: string
          bench: string | null
          confidence: number
          court_no: string | null
          created_at: string
          derived_at: string
          id: string
          policy_scope: Database["public"]["Enums"]["policy_scope"]
          policy_text: string
          priority_rule: Database["public"]["Enums"]["priority_rule"]
          raw_causelist_id: string
          source_page_number: number | null
          time_condition: Database["public"]["Enums"]["time_condition"]
        }
        Insert: {
          authority_level?: string
          bench?: string | null
          confidence?: number
          court_no?: string | null
          created_at?: string
          derived_at?: string
          id?: string
          policy_scope?: Database["public"]["Enums"]["policy_scope"]
          policy_text: string
          priority_rule?: Database["public"]["Enums"]["priority_rule"]
          raw_causelist_id: string
          source_page_number?: number | null
          time_condition?: Database["public"]["Enums"]["time_condition"]
        }
        Update: {
          authority_level?: string
          bench?: string | null
          confidence?: number
          court_no?: string | null
          created_at?: string
          derived_at?: string
          id?: string
          policy_scope?: Database["public"]["Enums"]["policy_scope"]
          policy_text?: string
          priority_rule?: Database["public"]["Enums"]["priority_rule"]
          raw_causelist_id?: string
          source_page_number?: number | null
          time_condition?: Database["public"]["Enums"]["time_condition"]
        }
        Relationships: [
          {
            foreignKeyName: "daily_execution_policies_raw_causelist_id_fkey"
            columns: ["raw_causelist_id"]
            isOneToOne: false
            referencedRelation: "raw_causelists"
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
      delegated_actions: {
        Row: {
          action_details: Json | null
          action_type: string
          actor_id: string
          chamber_id: string | null
          delegation_id: string
          id: string
          on_behalf_of: string
          performed_at: string
          target_id: string
          target_table: string
        }
        Insert: {
          action_details?: Json | null
          action_type: string
          actor_id: string
          chamber_id?: string | null
          delegation_id: string
          id?: string
          on_behalf_of: string
          performed_at?: string
          target_id: string
          target_table: string
        }
        Update: {
          action_details?: Json | null
          action_type?: string
          actor_id?: string
          chamber_id?: string | null
          delegation_id?: string
          id?: string
          on_behalf_of?: string
          performed_at?: string
          target_id?: string
          target_table?: string
        }
        Relationships: [
          {
            foreignKeyName: "delegated_actions_chamber_id_fkey"
            columns: ["chamber_id"]
            isOneToOne: false
            referencedRelation: "chambers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delegated_actions_delegation_id_fkey"
            columns: ["delegation_id"]
            isOneToOne: false
            referencedRelation: "clerk_delegations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delegated_actions_on_behalf_of_fkey"
            columns: ["on_behalf_of"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      intern_access_log: {
        Row: {
          action_type: string
          details: Json | null
          id: string
          intern_account_id: string
          logged_at: string
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action_type: string
          details?: Json | null
          id?: string
          intern_account_id: string
          logged_at?: string
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action_type?: string
          details?: Json | null
          id?: string
          intern_account_id?: string
          logged_at?: string
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intern_access_log_intern_account_id_fkey"
            columns: ["intern_account_id"]
            isOneToOne: false
            referencedRelation: "intern_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      intern_accounts: {
        Row: {
          chamber_id: string
          created_at: string
          expires_at: string
          id: string
          institution: string | null
          intern_name: string
          revocation_reason: string | null
          revoked_at: string | null
          supervisor_id: string
          user_id: string
        }
        Insert: {
          chamber_id: string
          created_at?: string
          expires_at: string
          id?: string
          institution?: string | null
          intern_name: string
          revocation_reason?: string | null
          revoked_at?: string | null
          supervisor_id: string
          user_id: string
        }
        Update: {
          chamber_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          institution?: string | null
          intern_name?: string
          revocation_reason?: string | null
          revoked_at?: string | null
          supervisor_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intern_accounts_chamber_id_fkey"
            columns: ["chamber_id"]
            isOneToOne: false
            referencedRelation: "chambers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_accounts_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      intern_case_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          docket_id: string
          expires_at: string | null
          id: string
          intern_account_id: string
          notes: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          docket_id: string
          expires_at?: string | null
          id?: string
          intern_account_id: string
          notes?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          docket_id?: string
          expires_at?: string | null
          id?: string
          intern_account_id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intern_case_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_case_assignments_docket_id_fkey"
            columns: ["docket_id"]
            isOneToOne: false
            referencedRelation: "daily_court_docket"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_case_assignments_docket_id_fkey"
            columns: ["docket_id"]
            isOneToOne: false
            referencedRelation: "user_docket_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_case_assignments_docket_id_fkey"
            columns: ["docket_id"]
            isOneToOne: false
            referencedRelation: "v_clerk_ownership_violations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_case_assignments_docket_id_fkey"
            columns: ["docket_id"]
            isOneToOne: false
            referencedRelation: "v_invalid_case_contexts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_case_assignments_intern_account_id_fkey"
            columns: ["intern_account_id"]
            isOneToOne: false
            referencedRelation: "intern_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      intern_drafts: {
        Row: {
          content: string
          created_at: string
          docket_id: string
          draft_type: string
          id: string
          intern_account_id: string
          review_notes: string | null
          review_status: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          submitted_at: string | null
          submitted_for_review: boolean
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          docket_id: string
          draft_type: string
          id?: string
          intern_account_id: string
          review_notes?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          submitted_at?: string | null
          submitted_for_review?: boolean
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          docket_id?: string
          draft_type?: string
          id?: string
          intern_account_id?: string
          review_notes?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          submitted_at?: string | null
          submitted_for_review?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "intern_drafts_docket_id_fkey"
            columns: ["docket_id"]
            isOneToOne: false
            referencedRelation: "daily_court_docket"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_drafts_docket_id_fkey"
            columns: ["docket_id"]
            isOneToOne: false
            referencedRelation: "user_docket_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_drafts_docket_id_fkey"
            columns: ["docket_id"]
            isOneToOne: false
            referencedRelation: "v_clerk_ownership_violations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_drafts_docket_id_fkey"
            columns: ["docket_id"]
            isOneToOne: false
            referencedRelation: "v_invalid_case_contexts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_drafts_intern_account_id_fkey"
            columns: ["intern_account_id"]
            isOneToOne: false
            referencedRelation: "intern_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_drafts_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "judge_observations_source_docket_id_fkey"
            columns: ["source_docket_id"]
            isOneToOne: false
            referencedRelation: "v_clerk_ownership_violations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "judge_observations_source_docket_id_fkey"
            columns: ["source_docket_id"]
            isOneToOne: false
            referencedRelation: "v_invalid_case_contexts"
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
          {
            foreignKeyName: "judgment_attachments_docket_id_fkey"
            columns: ["docket_id"]
            isOneToOne: false
            referencedRelation: "v_clerk_ownership_violations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "judgment_attachments_docket_id_fkey"
            columns: ["docket_id"]
            isOneToOne: false
            referencedRelation: "v_invalid_case_contexts"
            referencedColumns: ["id"]
          },
        ]
      }
      judgment_audit_log: {
        Row: {
          action: string
          case_judgment_id: string
          case_status_at_save: Database["public"]["Enums"]["case_proceeding_status"]
          id: string
          metadata: Json | null
          save_method: string
          saved_at: string
          saved_by_user_id: string
          tracked_case_id: string
        }
        Insert: {
          action?: string
          case_judgment_id: string
          case_status_at_save: Database["public"]["Enums"]["case_proceeding_status"]
          id?: string
          metadata?: Json | null
          save_method?: string
          saved_at?: string
          saved_by_user_id: string
          tracked_case_id: string
        }
        Update: {
          action?: string
          case_judgment_id?: string
          case_status_at_save?: Database["public"]["Enums"]["case_proceeding_status"]
          id?: string
          metadata?: Json | null
          save_method?: string
          saved_at?: string
          saved_by_user_id?: string
          tracked_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "judgment_audit_log_case_judgment_id_fkey"
            columns: ["case_judgment_id"]
            isOneToOne: false
            referencedRelation: "case_judgments"
            referencedColumns: ["id"]
          },
        ]
      }
      judgment_check_jobs: {
        Row: {
          attempts: number | null
          captcha_required: boolean | null
          completed_at: string | null
          created_at: string | null
          error_reason: string | null
          id: string
          last_attempt_at: string | null
          lawyer_id: string
          max_attempts: number | null
          next_attempt_at: string | null
          priority: number | null
          status: string
          tracked_case_id: string
        }
        Insert: {
          attempts?: number | null
          captcha_required?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          error_reason?: string | null
          id?: string
          last_attempt_at?: string | null
          lawyer_id: string
          max_attempts?: number | null
          next_attempt_at?: string | null
          priority?: number | null
          status?: string
          tracked_case_id: string
        }
        Update: {
          attempts?: number | null
          captcha_required?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          error_reason?: string | null
          id?: string
          last_attempt_at?: string | null
          lawyer_id?: string
          max_attempts?: number | null
          next_attempt_at?: string | null
          priority?: number | null
          status?: string
          tracked_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "judgment_check_jobs_lawyer_id_fkey"
            columns: ["lawyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "judgment_check_jobs_tracked_case_id_fkey"
            columns: ["tracked_case_id"]
            isOneToOne: false
            referencedRelation: "tracked_cases"
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
      lawyer_case_notes: {
        Row: {
          case_fingerprint: string
          created_at: string
          id: string
          lawyer_id: string
          notes: string
          updated_at: string
        }
        Insert: {
          case_fingerprint: string
          created_at?: string
          id?: string
          lawyer_id: string
          notes?: string
          updated_at?: string
        }
        Update: {
          case_fingerprint?: string
          created_at?: string
          id?: string
          lawyer_id?: string
          notes?: string
          updated_at?: string
        }
        Relationships: []
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
            foreignKeyName: "live_courtroom_feed_docket_id_fkey"
            columns: ["docket_id"]
            isOneToOne: false
            referencedRelation: "v_clerk_ownership_violations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_courtroom_feed_docket_id_fkey"
            columns: ["docket_id"]
            isOneToOne: false
            referencedRelation: "v_invalid_case_contexts"
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
          {
            foreignKeyName: "notifications_docket_id_fkey"
            columns: ["docket_id"]
            isOneToOne: false
            referencedRelation: "v_clerk_ownership_violations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_docket_id_fkey"
            columns: ["docket_id"]
            isOneToOne: false
            referencedRelation: "v_invalid_case_contexts"
            referencedColumns: ["id"]
          },
        ]
      }
      order_fetch_jobs: {
        Row: {
          attempts: number
          bench: Database["public"]["Enums"]["rhc_bench"] | null
          captcha_required: boolean
          completed_at: string | null
          court_order_id: string | null
          created_at: string
          error_reason: string | null
          id: string
          job_type: string
          last_attempt_at: string | null
          max_attempts: number
          next_attempt_at: string | null
          orders_found: number | null
          pdfs_downloaded: number | null
          priority: number
          started_at: string | null
          status: Database["public"]["Enums"]["order_job_status"]
          tracked_case_id: string | null
        }
        Insert: {
          attempts?: number
          bench?: Database["public"]["Enums"]["rhc_bench"] | null
          captcha_required?: boolean
          completed_at?: string | null
          court_order_id?: string | null
          created_at?: string
          error_reason?: string | null
          id?: string
          job_type: string
          last_attempt_at?: string | null
          max_attempts?: number
          next_attempt_at?: string | null
          orders_found?: number | null
          pdfs_downloaded?: number | null
          priority?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["order_job_status"]
          tracked_case_id?: string | null
        }
        Update: {
          attempts?: number
          bench?: Database["public"]["Enums"]["rhc_bench"] | null
          captcha_required?: boolean
          completed_at?: string | null
          court_order_id?: string | null
          created_at?: string
          error_reason?: string | null
          id?: string
          job_type?: string
          last_attempt_at?: string | null
          max_attempts?: number
          next_attempt_at?: string | null
          orders_found?: number | null
          pdfs_downloaded?: number | null
          priority?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["order_job_status"]
          tracked_case_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_fetch_jobs_court_order_id_fkey"
            columns: ["court_order_id"]
            isOneToOne: false
            referencedRelation: "court_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_fetch_jobs_tracked_case_id_fkey"
            columns: ["tracked_case_id"]
            isOneToOne: false
            referencedRelation: "tracked_cases"
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
          {
            foreignKeyName: "post_court_notes_docket_id_fkey"
            columns: ["docket_id"]
            isOneToOne: false
            referencedRelation: "v_clerk_ownership_violations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_court_notes_docket_id_fkey"
            columns: ["docket_id"]
            isOneToOne: false
            referencedRelation: "v_invalid_case_contexts"
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
          input_format:
            | Database["public"]["Enums"]["causelist_input_format"]
            | null
          list_date: string
          list_type: string
          page_count: number | null
          query_lawyer_name: string | null
          source: string | null
          source_granularity:
            | Database["public"]["Enums"]["source_granularity"]
            | null
          source_type:
            | Database["public"]["Enums"]["causelist_source_type"]
            | null
          status: string | null
          storage_path: string
          structure_confidence: number | null
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
          input_format?:
            | Database["public"]["Enums"]["causelist_input_format"]
            | null
          list_date: string
          list_type: string
          page_count?: number | null
          query_lawyer_name?: string | null
          source?: string | null
          source_granularity?:
            | Database["public"]["Enums"]["source_granularity"]
            | null
          source_type?:
            | Database["public"]["Enums"]["causelist_source_type"]
            | null
          status?: string | null
          storage_path: string
          structure_confidence?: number | null
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
          input_format?:
            | Database["public"]["Enums"]["causelist_input_format"]
            | null
          list_date?: string
          list_type?: string
          page_count?: number | null
          query_lawyer_name?: string | null
          source?: string | null
          source_granularity?:
            | Database["public"]["Enums"]["source_granularity"]
            | null
          source_type?:
            | Database["public"]["Enums"]["causelist_source_type"]
            | null
          status?: string | null
          storage_path?: string
          structure_confidence?: number | null
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
      security_events: {
        Row: {
          attempted_action: string
          created_at: string | null
          event_type: string
          id: string
          reason: string
          request_metadata: Json | null
          target_id: string | null
          target_table: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          attempted_action: string
          created_at?: string | null
          event_type: string
          id?: string
          reason: string
          request_metadata?: Json | null
          target_id?: string | null
          target_table?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          attempted_action?: string
          created_at?: string | null
          event_type?: string
          id?: string
          reason?: string
          request_metadata?: Json | null
          target_id?: string | null
          target_table?: string | null
          user_id?: string | null
          user_role?: string | null
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
      synced_court_documents: {
        Row: {
          court_label: string
          created_at: string
          doc_type: Database["public"]["Enums"]["doc_sync_type"]
          fetched_at: string
          id: string
          lawyer_id: string
          order_date: string | null
          pdf_hash: string | null
          pdf_size_bytes: number | null
          source_pdf_url: string
          stored_pdf_path: string | null
          tracked_case_id: string
        }
        Insert: {
          court_label: string
          created_at?: string
          doc_type?: Database["public"]["Enums"]["doc_sync_type"]
          fetched_at?: string
          id?: string
          lawyer_id: string
          order_date?: string | null
          pdf_hash?: string | null
          pdf_size_bytes?: number | null
          source_pdf_url: string
          stored_pdf_path?: string | null
          tracked_case_id: string
        }
        Update: {
          court_label?: string
          created_at?: string
          doc_type?: Database["public"]["Enums"]["doc_sync_type"]
          fetched_at?: string
          id?: string
          lawyer_id?: string
          order_date?: string | null
          pdf_hash?: string | null
          pdf_size_bytes?: number | null
          source_pdf_url?: string
          stored_pdf_path?: string | null
          tracked_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "synced_court_documents_lawyer_id_fkey"
            columns: ["lawyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "synced_court_documents_tracked_case_id_fkey"
            columns: ["tracked_case_id"]
            isOneToOne: false
            referencedRelation: "tracked_cases"
            referencedColumns: ["id"]
          },
        ]
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
      tracked_cases: {
        Row: {
          bench: Database["public"]["Enums"]["rhc_bench"]
          case_number: number
          case_status: string | null
          case_type: string
          case_year: number
          created_at: string
          document_sync_attempts: number | null
          document_sync_status:
            | Database["public"]["Enums"]["document_sync_status"]
            | null
          id: string
          is_active: boolean
          judgment_check_attempts: number | null
          judgment_found_at: string | null
          judgment_status: Database["public"]["Enums"]["judgment_status"] | null
          last_document_sync_at: string | null
          last_judgment_check_at: string | null
          last_listed_date: string | null
          last_orders_check_at: string | null
          listed_today: boolean
          next_document_sync_after: string | null
          next_judgment_check_after: string | null
          orders_count: number
          petitioner: string | null
          petitioner_advocate: string | null
          proceeding_status:
            | Database["public"]["Enums"]["case_proceeding_status"]
            | null
          profile_id: string
          respondent: string | null
          respondent_advocate: string | null
          total_documents_synced: number | null
          updated_at: string
        }
        Insert: {
          bench: Database["public"]["Enums"]["rhc_bench"]
          case_number: number
          case_status?: string | null
          case_type: string
          case_year: number
          created_at?: string
          document_sync_attempts?: number | null
          document_sync_status?:
            | Database["public"]["Enums"]["document_sync_status"]
            | null
          id?: string
          is_active?: boolean
          judgment_check_attempts?: number | null
          judgment_found_at?: string | null
          judgment_status?:
            | Database["public"]["Enums"]["judgment_status"]
            | null
          last_document_sync_at?: string | null
          last_judgment_check_at?: string | null
          last_listed_date?: string | null
          last_orders_check_at?: string | null
          listed_today?: boolean
          next_document_sync_after?: string | null
          next_judgment_check_after?: string | null
          orders_count?: number
          petitioner?: string | null
          petitioner_advocate?: string | null
          proceeding_status?:
            | Database["public"]["Enums"]["case_proceeding_status"]
            | null
          profile_id: string
          respondent?: string | null
          respondent_advocate?: string | null
          total_documents_synced?: number | null
          updated_at?: string
        }
        Update: {
          bench?: Database["public"]["Enums"]["rhc_bench"]
          case_number?: number
          case_status?: string | null
          case_type?: string
          case_year?: number
          created_at?: string
          document_sync_attempts?: number | null
          document_sync_status?:
            | Database["public"]["Enums"]["document_sync_status"]
            | null
          id?: string
          is_active?: boolean
          judgment_check_attempts?: number | null
          judgment_found_at?: string | null
          judgment_status?:
            | Database["public"]["Enums"]["judgment_status"]
            | null
          last_document_sync_at?: string | null
          last_judgment_check_at?: string | null
          last_listed_date?: string | null
          last_orders_check_at?: string | null
          listed_today?: boolean
          next_document_sync_after?: string | null
          next_judgment_check_after?: string | null
          orders_count?: number
          petitioner?: string | null
          petitioner_advocate?: string | null
          proceeding_status?:
            | Database["public"]["Enums"]["case_proceeding_status"]
            | null
          profile_id?: string
          respondent?: string | null
          respondent_advocate?: string | null
          total_documents_synced?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracked_cases_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      vc_click_events: {
        Row: {
          click_date: string
          clicked_at: string | null
          court_location: string
          court_room_no: string
          docket_id: string | null
          id: string
          user_id: string | null
          vc_meeting_id: string
        }
        Insert: {
          click_date: string
          clicked_at?: string | null
          court_location: string
          court_room_no: string
          docket_id?: string | null
          id?: string
          user_id?: string | null
          vc_meeting_id: string
        }
        Update: {
          click_date?: string
          clicked_at?: string | null
          court_location?: string
          court_room_no?: string
          docket_id?: string | null
          id?: string
          user_id?: string | null
          vc_meeting_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vc_click_events_docket_id_fkey"
            columns: ["docket_id"]
            isOneToOne: false
            referencedRelation: "daily_court_docket"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vc_click_events_docket_id_fkey"
            columns: ["docket_id"]
            isOneToOne: false
            referencedRelation: "user_docket_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vc_click_events_docket_id_fkey"
            columns: ["docket_id"]
            isOneToOne: false
            referencedRelation: "v_clerk_ownership_violations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vc_click_events_docket_id_fkey"
            columns: ["docket_id"]
            isOneToOne: false
            referencedRelation: "v_invalid_case_contexts"
            referencedColumns: ["id"]
          },
        ]
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
      v_clerk_ownership_violations: {
        Row: {
          case_number: string | null
          date: string | null
          id: string | null
          matched_profile_id: string | null
          role: Database["public"]["Enums"]["app_role"] | null
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
      v_delegation_scope_violations: {
        Row: {
          action_type: string | null
          actor_id: string | null
          id: string | null
          performed_at: string | null
          target_table: string | null
        }
        Relationships: []
      }
      v_invalid_case_contexts: {
        Row: {
          case_context: Database["public"]["Enums"]["case_context"] | null
          case_number: string | null
          chamber_id: string | null
          date: string | null
          id: string | null
          matched_profile_id: string | null
        }
        Insert: {
          case_context?: Database["public"]["Enums"]["case_context"] | null
          case_number?: string | null
          chamber_id?: string | null
          date?: string | null
          id?: string | null
          matched_profile_id?: string | null
        }
        Update: {
          case_context?: Database["public"]["Enums"]["case_context"] | null
          case_number?: string | null
          chamber_id?: string | null
          date?: string | null
          id?: string | null
          matched_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_court_docket_chamber_id_fkey"
            columns: ["chamber_id"]
            isOneToOne: false
            referencedRelation: "chambers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_court_docket_matched_profile_id_fkey"
            columns: ["matched_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_unattributed_mutations: {
        Row: {
          attempted_action: string | null
          created_at: string | null
          id: string | null
          reason: string | null
          target_id: string | null
          target_table: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          attempted_action?: string | null
          created_at?: string | null
          id?: string | null
          reason?: string | null
          target_id?: string | null
          target_table?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          attempted_action?: string | null
          created_at?: string | null
          id?: string | null
          reason?: string | null
          target_id?: string | null
          target_table?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      acquire_document_sync_lock: {
        Args: { p_case_id: string; p_lawyer_id: string }
        Returns: Json
      }
      admin_match_cases_for_profile: {
        Args: {
          p_alias_pattern: string
          p_from_date?: string
          p_profile_id: string
        }
        Returns: Json
      }
      archive_old_causelists: { Args: never; Returns: number }
      can_check_judgment: {
        Args: { p_case_id: string; p_lawyer_id: string }
        Returns: Json
      }
      can_manage_chamber_interns: {
        Args: { _chamber_id: string; _user_id: string }
        Returns: boolean
      }
      can_sync_documents: {
        Args: { p_case_id: string; p_lawyer_id: string }
        Returns: Json
      }
      can_view_chamber_cases: {
        Args: { _chamber_id: string; _user_id: string }
        Returns: boolean
      }
      cleanup_old_scraper_logs: { Args: never; Returns: number }
      clerk_can_edit_case: {
        Args: { _case_owner_id: string; _clerk_id: string }
        Returns: boolean
      }
      clerk_can_view_case: {
        Args: { _case_owner_id: string; _clerk_id: string }
        Returns: boolean
      }
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
      get_active_delegation: {
        Args: { _clerk_id: string; _lawyer_id: string }
        Returns: string
      }
      get_intern_account_id: { Args: { _user_id: string }; Returns: string }
      get_judgment_eligibility: {
        Args: { p_case_id: string }
        Returns: {
          current_status: string
          is_eligible: boolean
          reason: string
        }[]
      }
      get_next_pending_job: {
        Args: { p_bench?: Database["public"]["Enums"]["rhc_bench"] }
        Returns: {
          bench: Database["public"]["Enums"]["rhc_bench"]
          case_id: string
          job_id: string
          job_type: string
        }[]
      }
      get_previous_appearance_counts: {
        Args: { before_date: string; fingerprints: string[] }
        Returns: {
          appearance_count: number
          case_fingerprint: string
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_active_subscription: { Args: { p_user_id: string }; Returns: boolean }
      has_delegation_scope: {
        Args: {
          _clerk_id: string
          _lawyer_id: string
          _scope: Database["public"]["Enums"]["delegation_scope"]
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_document_count: {
        Args: { p_case_id: string; p_increment?: number }
        Returns: number
      }
      increment_document_sync_attempt: {
        Args: { p_case_id: string }
        Returns: number
      }
      intern_can_access_case: {
        Args: { _docket_id: string; _user_id: string }
        Returns: boolean
      }
      is_active_intern: { Args: { _user_id: string }; Returns: boolean }
      is_chamber_member: {
        Args: { _chamber_id: string; _user_id: string }
        Returns: boolean
      }
      is_chamber_owner: {
        Args: { _chamber_id: string; _user_id: string }
        Returns: boolean
      }
      is_clerk_role: { Args: { _user_id: string }; Returns: boolean }
      is_delegated_clerk: {
        Args: { _clerk_id: string; _lawyer_id: string }
        Returns: boolean
      }
      is_fallback_disabled: { Args: { p_bench_code: string }; Returns: boolean }
      is_intern_supervisor: {
        Args: { _intern_account_id: string; _user_id: string }
        Returns: boolean
      }
      is_judgment_eligible_status: {
        Args: {
          p_status: Database["public"]["Enums"]["case_proceeding_status"]
        }
        Returns: boolean
      }
      is_lawyer_role: { Args: { _user_id: string }; Returns: boolean }
      log_delegated_action: {
        Args: {
          _action_details?: Json
          _action_type: string
          _actor_id: string
          _on_behalf_of: string
          _target_id: string
          _target_table: string
        }
        Returns: string
      }
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
      log_intern_access: {
        Args: {
          p_action_type: string
          p_details?: Json
          p_target_id?: string
          p_target_table?: string
        }
        Returns: string
      }
      log_security_event: {
        Args: {
          p_attempted_action: string
          p_event_type: string
          p_metadata?: Json
          p_reason: string
          p_target_id: string
          p_target_table: string
        }
        Returns: string
      }
      normalize_lawyer_name: { Args: { name: string }; Returns: string }
      queue_judgment_check: {
        Args: { p_case_id: string; p_lawyer_id: string }
        Returns: Json
      }
      release_document_sync_lock: {
        Args: {
          p_case_id: string
          p_documents_added?: number
          p_success: boolean
        }
        Returns: undefined
      }
      revoke_expired_intern_accounts: { Args: never; Returns: Json }
      try_lock_case_for_job: {
        Args: { p_case_id: string; p_job_type: string }
        Returns: string
      }
      update_case_proceeding_status: {
        Args: {
          p_case_id: string
          p_new_status: Database["public"]["Enums"]["case_proceeding_status"]
        }
        Returns: boolean
      }
      validate_case_ownership: {
        Args: { p_case_id: string; p_lawyer_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "SENIOR" | "JUNIOR" | "CLERK" | "ADMIN" | "INTERN"
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
      case_context: "personal" | "chamber"
      case_proceeding_status:
        | "listed"
        | "hearing"
        | "running"
        | "adjourned"
        | "not_reached"
        | "reserved_for_judgment"
        | "judgment_pronounced"
        | "disposed_without_judgment"
        | "dismissed"
        | "withdrawn"
      causelist_input_format: "PDF" | "HTML"
      causelist_source_type: "PDF" | "HTML_COMPLETE" | "HTML_SEARCH"
      chamber_role: "senior" | "junior" | "clerk"
      confidence_level: "excellent" | "good" | "degraded" | "risky" | "unsafe"
      delegation_scope:
        | "view_cases"
        | "upload_documents"
        | "add_notes"
        | "track_hearings"
        | "mark_presence"
        | "edit_cases"
        | "manage_documents"
      doc_sync_type: "judgment" | "interim_order" | "order" | "unknown"
      document_format: "TYPED" | "SCANNED" | "HANDWRITTEN"
      document_language: "EN" | "HI" | "MIXED" | "UNKNOWN"
      document_legibility: "CLEAR" | "AVERAGE" | "POOR"
      document_sync_status:
        | "not_synced"
        | "sync_queued"
        | "syncing"
        | "synced"
        | "sync_failed"
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
      hearing_likelihood:
        | "LIKELY"
        | "CONDITIONAL"
        | "LOW_PROBABILITY"
        | "UNKNOWN"
      hearing_source: "post_court" | "manual"
      judgment_status:
        | "not_checked"
        | "check_queued"
        | "checking"
        | "not_found"
        | "found"
      order_fetch_trigger: "manual" | "backfill" | "post_listing" | "scheduled"
      order_job_status:
        | "pending"
        | "running"
        | "completed"
        | "failed"
        | "captcha_blocked"
        | "manual_required"
      policy_scope: "GLOBAL" | "COURT" | "BENCH" | "UNKNOWN"
      priority_rule:
        | "SUPPLEMENTARY_FIRST"
        | "MAIN_ONLY"
        | "TIME_BOUND"
        | "UNSPECIFIED"
      rhc_bench: "JAIPUR" | "JODHPUR"
      risk_type: "ux" | "trust" | "operational" | "legal" | "scale"
      source_granularity: "FULL_CAUSELIST" | "COURT_SECTION" | "LAWYER_FILTERED"
      time_condition: "IF_TIME_PERMITS" | "FIXED_ORDER" | "UNKNOWN"
      vc_provider: "webex"
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
      app_role: ["SENIOR", "JUNIOR", "CLERK", "ADMIN", "INTERN"],
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
      case_context: ["personal", "chamber"],
      case_proceeding_status: [
        "listed",
        "hearing",
        "running",
        "adjourned",
        "not_reached",
        "reserved_for_judgment",
        "judgment_pronounced",
        "disposed_without_judgment",
        "dismissed",
        "withdrawn",
      ],
      causelist_input_format: ["PDF", "HTML"],
      causelist_source_type: ["PDF", "HTML_COMPLETE", "HTML_SEARCH"],
      chamber_role: ["senior", "junior", "clerk"],
      confidence_level: ["excellent", "good", "degraded", "risky", "unsafe"],
      delegation_scope: [
        "view_cases",
        "upload_documents",
        "add_notes",
        "track_hearings",
        "mark_presence",
        "edit_cases",
        "manage_documents",
      ],
      doc_sync_type: ["judgment", "interim_order", "order", "unknown"],
      document_format: ["TYPED", "SCANNED", "HANDWRITTEN"],
      document_language: ["EN", "HI", "MIXED", "UNKNOWN"],
      document_legibility: ["CLEAR", "AVERAGE", "POOR"],
      document_sync_status: [
        "not_synced",
        "sync_queued",
        "syncing",
        "synced",
        "sync_failed",
      ],
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
      hearing_likelihood: [
        "LIKELY",
        "CONDITIONAL",
        "LOW_PROBABILITY",
        "UNKNOWN",
      ],
      hearing_source: ["post_court", "manual"],
      judgment_status: [
        "not_checked",
        "check_queued",
        "checking",
        "not_found",
        "found",
      ],
      order_fetch_trigger: ["manual", "backfill", "post_listing", "scheduled"],
      order_job_status: [
        "pending",
        "running",
        "completed",
        "failed",
        "captcha_blocked",
        "manual_required",
      ],
      policy_scope: ["GLOBAL", "COURT", "BENCH", "UNKNOWN"],
      priority_rule: [
        "SUPPLEMENTARY_FIRST",
        "MAIN_ONLY",
        "TIME_BOUND",
        "UNSPECIFIED",
      ],
      rhc_bench: ["JAIPUR", "JODHPUR"],
      risk_type: ["ux", "trust", "operational", "legal", "scale"],
      source_granularity: [
        "FULL_CAUSELIST",
        "COURT_SECTION",
        "LAWYER_FILTERED",
      ],
      time_condition: ["IF_TIME_PERMITS", "FIXED_ORDER", "UNKNOWN"],
      vc_provider: ["webex"],
    },
  },
} as const
