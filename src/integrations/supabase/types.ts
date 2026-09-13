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
    PostgrestVersion: "14.5"
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
      audit_archive: {
        Row: {
          archived_at: string
          id: string
          payload: Json
        }
        Insert: {
          archived_at?: string
          id: string
          payload: Json
        }
        Update: {
          archived_at?: string
          id?: string
          payload?: Json
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          actor_role: string | null
          category: string
          created_at: string
          description: string
          election_id: string | null
          id: string
          ip_address: unknown
          ip_address_hash: string | null
          metadata: Json
          original_description: string | null
          request_id: string | null
          schema_version: string | null
          severity: string
          target_id: string | null
          target_type: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: string | null
          category?: string
          created_at?: string
          description: string
          election_id?: string | null
          id?: string
          ip_address?: unknown
          ip_address_hash?: string | null
          metadata?: Json
          original_description?: string | null
          request_id?: string | null
          schema_version?: string | null
          severity?: string
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: string | null
          category?: string
          created_at?: string
          description?: string
          election_id?: string | null
          id?: string
          ip_address?: unknown
          ip_address_hash?: string | null
          metadata?: Json
          original_description?: string | null
          request_id?: string | null
          schema_version?: string | null
          severity?: string
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "election_events"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_notifications: {
        Row: {
          candidate_id: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          type: string
          user_id: string | null
        }
        Insert: {
          candidate_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          type: string
          user_id?: string | null
        }
        Update: {
          candidate_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_notifications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_pair_members: {
        Row: {
          candidate_id: string
          created_at: string
          id: string
          pair_id: string
          position: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string
          id?: string
          pair_id: string
          position?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string
          id?: string
          pair_id?: string
          position?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_pair_members_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_pair_members_pair_id_fkey"
            columns: ["pair_id"]
            isOneToOne: false
            referencedRelation: "candidate_pairs"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_pairs: {
        Row: {
          admin_notes: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          event_id: string
          id: string
          label: string | null
          mission: string | null
          number: number | null
          photo_storage_path: string | null
          photo_url: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["candidate_status"]
          updated_at: string
          vision: string | null
        }
        Insert: {
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          event_id: string
          id?: string
          label?: string | null
          mission?: string | null
          number?: number | null
          photo_storage_path?: string | null
          photo_url?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["candidate_status"]
          updated_at?: string
          vision?: string | null
        }
        Update: {
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          event_id?: string
          id?: string
          label?: string | null
          mission?: string | null
          number?: number | null
          photo_storage_path?: string | null
          photo_url?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["candidate_status"]
          updated_at?: string
          vision?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_pairs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "election_events"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          admin_notes: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          event_id: string
          id: string
          mission: string | null
          photo_storage_path: string | null
          photo_url: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["candidate_status"]
          updated_at: string
          user_id: string
          vision: string | null
        }
        Insert: {
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          event_id: string
          id?: string
          mission?: string | null
          photo_storage_path?: string | null
          photo_url?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["candidate_status"]
          updated_at?: string
          user_id: string
          vision?: string | null
        }
        Update: {
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          event_id?: string
          id?: string
          mission?: string | null
          photo_storage_path?: string | null
          photo_url?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["candidate_status"]
          updated_at?: string
          user_id?: string
          vision?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidates_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "election_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          faculty: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          faculty?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          faculty?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      election_committees: {
        Row: {
          appointed_at: string
          appointed_by: string | null
          committee_role: Database["public"]["Enums"]["committee_role"]
          election_id: string
          id: string
          notes: string | null
          revoked_at: string | null
          revoked_by: string | null
          revoked_reason: string | null
          user_id: string
        }
        Insert: {
          appointed_at?: string
          appointed_by?: string | null
          committee_role: Database["public"]["Enums"]["committee_role"]
          election_id: string
          id?: string
          notes?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          user_id: string
        }
        Update: {
          appointed_at?: string
          appointed_by?: string | null
          committee_role?: Database["public"]["Enums"]["committee_role"]
          election_id?: string
          id?: string
          notes?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "election_committees_appointed_by_fkey"
            columns: ["appointed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "election_committees_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "election_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "election_committees_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "election_committees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      election_events: {
        Row: {
          created_at: string
          description: string | null
          election_type: Database["public"]["Enums"]["election_type"]
          end_time: string
          id: string
          public_results: boolean
          show_results_after_voting: boolean
          start_time: string
          status: string
          title: string
          updated_at: string
          use_pairs: boolean
        }
        Insert: {
          created_at?: string
          description?: string | null
          election_type?: Database["public"]["Enums"]["election_type"]
          end_time: string
          id?: string
          public_results?: boolean
          show_results_after_voting?: boolean
          start_time: string
          status?: string
          title: string
          updated_at?: string
          use_pairs?: boolean
        }
        Update: {
          created_at?: string
          description?: string | null
          election_type?: Database["public"]["Enums"]["election_type"]
          end_time?: string
          id?: string
          public_results?: boolean
          show_results_after_voting?: boolean
          start_time?: string
          status?: string
          title?: string
          updated_at?: string
          use_pairs?: boolean
        }
        Relationships: []
      }
      election_observations: {
        Row: {
          category: string
          created_at: string
          description: string
          election_id: string
          id: string
          metadata: Json
          observer_id: string
          resolved_at: string | null
          resolved_by: string | null
          severity: string
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          election_id: string
          id?: string
          metadata?: Json
          observer_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          election_id?: string
          id?: string
          metadata?: Json
          observer_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "election_observations_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "election_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "election_observations_observer_id_fkey"
            columns: ["observer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "election_observations_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      election_observers: {
        Row: {
          appointed_at: string
          appointed_by: string | null
          election_id: string
          id: string
          revoked_at: string | null
          revoked_by: string | null
          revoked_reason: string | null
          user_id: string
        }
        Insert: {
          appointed_at?: string
          appointed_by?: string | null
          election_id: string
          id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          user_id: string
        }
        Update: {
          appointed_at?: string
          appointed_by?: string | null
          election_id?: string
          id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "election_observers_appointed_by_fkey"
            columns: ["appointed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "election_observers_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "election_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "election_observers_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "election_observers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_voter_groups: {
        Row: {
          class_id: string
          created_at: string
          event_id: string
          id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          event_id: string
          id?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          event_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_voter_groups_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_voter_groups_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "election_events"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_user_id: string | null
          class_id: string | null
          created_at: string
          email: string
          event_id: string | null
          expires_at: string
          full_name: string | null
          id: string
          intent: string
          invited_by: string | null
          metadata: Json
          revoked_at: string | null
          roles: string[]
          student_id: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          class_id?: string | null
          created_at?: string
          email: string
          event_id?: string | null
          expires_at: string
          full_name?: string | null
          id?: string
          intent: string
          invited_by?: string | null
          metadata?: Json
          revoked_at?: string | null
          roles?: string[]
          student_id?: string | null
          token: string
        }
        Update: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          class_id?: string | null
          created_at?: string
          email?: string
          event_id?: string | null
          expires_at?: string
          full_name?: string | null
          id?: string
          intent?: string
          invited_by?: string | null
          metadata?: Json
          revoked_at?: string | null
          roles?: string[]
          student_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "election_events"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          class_id: string | null
          created_at: string
          department: string | null
          full_name: string
          id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          department?: string | null
          full_name: string
          id: string
          student_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          department?: string | null
          full_name?: string
          id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          granted_at: string
          granted_by: string | null
          permission: Database["public"]["Enums"]["permission_key"]
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          permission: Database["public"]["Enums"]["permission_key"]
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          permission?: Database["public"]["Enums"]["permission_key"]
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_granted_by_fkey"
            columns: ["granted_by"]
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
      user_sessions: {
        Row: {
          created_at: string
          device_label: string | null
          expires_at: string | null
          id: string
          ip_address: unknown
          is_current: boolean
          last_seen_at: string
          refresh_token_hash: string
          revoked_at: string | null
          revoked_reason: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_label?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: unknown
          is_current?: boolean
          last_seen_at?: string
          refresh_token_hash: string
          revoked_at?: string | null
          revoked_reason?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_label?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: unknown
          is_current?: boolean
          last_seen_at?: string
          refresh_token_hash?: string
          revoked_at?: string | null
          revoked_reason?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      votes: {
        Row: {
          candidate_id: string | null
          created_at: string
          event_id: string
          id: string
          pair_id: string | null
          voter_id: string
        }
        Insert: {
          candidate_id?: string | null
          created_at?: string
          event_id: string
          id?: string
          pair_id?: string | null
          voter_id: string
        }
        Update: {
          candidate_id?: string | null
          created_at?: string
          event_id?: string
          id?: string
          pair_id?: string | null
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "election_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_pair_id_fkey"
            columns: ["pair_id"]
            isOneToOne: false
            referencedRelation: "candidate_pairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      election_audit_by_election: {
        Row: {
          action: string | null
          actor_email: string | null
          actor_full_name: string | null
          actor_id: string | null
          actor_role: string | null
          actor_student_id: string | null
          category: string | null
          created_at: string | null
          description: string | null
          election_id: string | null
          election_title: string | null
          id: string | null
          ip_address: unknown
          ip_address_hash: string | null
          metadata: Json | null
          original_description: string | null
          request_id: string | null
          schema_version: string | null
          severity: string | null
          target_id: string | null
          target_type: string | null
          user_agent: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "election_events"
            referencedColumns: ["id"]
          },
        ]
      }
      election_audit_trail: {
        Row: {
          action: string | null
          actor_email: string | null
          actor_full_name: string | null
          actor_id: string | null
          actor_role: string | null
          actor_student_id: string | null
          category: string | null
          created_at: string | null
          description: string | null
          election_id: string | null
          id: string | null
          ip_address_hash: string | null
          metadata: Json | null
          request_id: string | null
          schema_version: string | null
          severity: string | null
          target_id: string | null
          target_type: string | null
          user_agent: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "election_events"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_invitation_and_register: {
        Args: { p_password: string; p_token: string }
        Returns: string
      }
      add_election_observation: {
        Args: {
          p_category: string
          p_description: string
          p_election_id: string
          p_metadata?: Json
          p_severity?: string
        }
        Returns: string
      }
      admin_add_eligibility_rule: {
        Args: {
          p_description?: string
          p_election_id: string
          p_rule_type: string
          p_rule_value: string
        }
        Returns: string
      }
      admin_archive_old_audit_entries: {
        Args: { p_older_than: string }
        Returns: number
      }
      admin_assign_committee: {
        Args: {
          p_election_id: string
          p_role: Database["public"]["Enums"]["committee_role"]
          p_user_id: string
        }
        Returns: string
      }
      admin_assign_observer: {
        Args: { p_election_id: string; p_user_id: string }
        Returns: string
      }
      admin_correct_audit_entry: {
        Args: {
          p_correction_reason: string
          p_entry_id: string
          p_new_description: string
        }
        Returns: string
      }
      admin_create_invitation: {
        Args: {
          p_class_id?: string
          p_email: string
          p_event_id?: string
          p_expires_at?: string
          p_full_name?: string
          p_intent?: string
          p_metadata?: Json
          p_roles?: string[]
          p_student_id?: string
        }
        Returns: { id: string; token: string }[]
      }
      admin_create_user: {
        Args: {
          p_class_id?: string
          p_department?: string
          p_email: string
          p_full_name: string
          p_password: string
          p_skip_confirmation?: boolean
          p_student_id: string
        }
        Returns: string
      }
      admin_export_audit_log: {
        Args: {
          p_election_id?: string
          p_from_date?: string
          p_limit?: number
          p_offset?: number
          p_to_date?: string
        }
        Returns: Json
      }
      admin_list_invitations: {
        Args: never
        Returns: {
          accepted_at: string | null
          accepted_user_id: string | null
          class_id: string | null
          created_at: string
          email: string
          event_id: string | null
          expires_at: string
          full_name: string | null
          id: string
          intent: string
          revoked_at: string | null
          roles: string[]
          student_id: string | null
          token: string
        }[]
      }
      admin_list_users: {
        Args: never
        Returns: {
          class_id: string | null
          class_name: string | null
          department: string | null
          email: string
          full_name: string
          id: string
          roles: Database["public"]["Enums"]["app_role"][]
          student_id: string
        }[]
      }
      admin_lookup_user_id_by_email: {
        Args: { p_email: string }
        Returns: string
      }
      admin_remove_eligibility_rule: {
        Args: { p_rule_id: string }
        Returns: undefined
      }
      admin_revoke_committee: {
        Args: { p_committee_id: string; p_reason?: string }
        Returns: undefined
      }
      admin_revoke_observer: {
        Args: { p_observer_id: string; p_reason?: string }
        Returns: undefined
      }
      admin_revoke_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      admin_update_password: {
        Args: { p_password: string; p_user_id: string }
        Returns: undefined
      }
      admin_transition_election_state: {
        Args: { p_election_id: string; p_reason?: string; p_to_status: string }
        Returns: string
      }
      assert_event_is_votable: {
        Args: { p_event_id: string }
        Returns: undefined
      }
      caller_has_permission: {
        Args: { p_permission: Database["public"]["Enums"]["permission_key"] }
        Returns: boolean
      }
      can_access_election: {
        Args: { p_election_id: string; p_user_id: string }
        Returns: boolean
      }
      can_manage_election: {
        Args: { p_election_id: string; p_user_id: string }
        Returns: boolean
      }
      create_admin_user: {
        Args: {
          p_email: string
          p_full_name: string
          p_password: string
          p_student_id: string
        }
        Returns: string
      }
      get_election_tally: {
        Args: { p_event_id: string }
        Returns: {
          candidate_id: string
          pair_id: string
          total_votes: number
        }[]
      }
      get_user_email: { Args: { user_id: string }; Returns: string }
      get_invitation_by_token: {
        Args: { p_token: string }
        Returns: {
          accepted_at: string | null
          class_id: string | null
          email: string
          event_id: string | null
          expires_at: string
          full_name: string | null
          id: string
          intent: string
          revoked_at: string | null
          roles: string[]
          student_id: string | null
        }[]
      }
      has_election_role: {
        Args: { p_election_id: string; p_role: string; p_user_id: string }
        Returns: boolean
      }
      has_permission: {
        Args: {
          p_permission: Database["public"]["Enums"]["permission_key"]
          p_user_id: string
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
      list_my_committee_assignments: {
        Args: never
        Returns: {
          appointed_at: string
          committee_id: string
          committee_role: Database["public"]["Enums"]["committee_role"]
          election_id: string
          election_title: string
        }[]
      }
      list_my_observer_assignments: {
        Args: never
        Returns: {
          appointed_at: string
          election_id: string
          election_title: string
          observer_id: string
        }[]
      }
      log_audit_event: {
        Args: {
          p_action: string
          p_category?: string
          p_description: string
          p_ip_address?: unknown
          p_metadata?: Json
          p_severity?: string
          p_target_id?: string
          p_target_type?: string
          p_user_agent?: string
        }
        Returns: string
      }
      log_failed_login: { Args: { p_email: string }; Returns: undefined }
      make_user_admin: { Args: { user_email: string }; Returns: undefined }
      redeem_invitation: {
        Args: { p_token: string }
        Returns: {
          class_id: string
          email: string
          event_id: string
          intent: string
          invitation_id: string
          roles: string[]
          user_id: string
        }[]
      }
      register_user_session: {
        Args: {
          p_device_label?: string
          p_expires_at?: string
          p_ip_address?: unknown
          p_refresh_token_hash: string
          p_user_agent?: string
        }
        Returns: string
      }
      revoke_user_session: {
        Args: { p_revoked_reason?: string; p_session_id: string }
        Returns: undefined
      }
      revoke_user_session_by_hash: {
        Args: { p_refresh_token_hash: string; p_revoked_reason?: string }
        Returns: undefined
      }
      touch_user_session: {
        Args: { p_refresh_token_hash: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "voter" | "candidate" | "committee" | "observer"
      candidate_status: "pending" | "approved" | "rejected"
      committee_role:
        | "chair"
        | "secretary"
        | "verifier"
        | "technical"
        | "member"
      election_type: "open" | "closed"
      permission_key:
        | "election.view"
        | "election.update"
        | "election.publish"
        | "election.delete"
        | "election.transition"
        | "candidate.view"
        | "candidate.create"
        | "candidate.review"
        | "candidate.approve"
        | "candidate.reject"
        | "candidate.edit"
        | "vote.cast"
        | "vote.view"
        | "vote.count"
        | "vote.export"
        | "voter.view"
        | "voter.verify"
        | "voter.manage"
        | "committee.manage"
        | "committee.view"
        | "observer.manage"
        | "observer.view"
        | "audit.view"
        | "audit.export"
        | "user.create"
        | "user.edit"
        | "user.delete"
        | "user.reset_password"
        | "system.manage"
        | "system.settings"
        | "eligibility.manage"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "voter", "candidate", "committee", "observer"],
      candidate_status: ["pending", "approved", "rejected"],
      committee_role: ["chair", "secretary", "verifier", "technical", "member"],
      election_type: ["open", "closed"],
      permission_key: [
        "election.view",
        "election.update",
        "election.publish",
        "election.delete",
        "election.transition",
        "candidate.view",
        "candidate.create",
        "candidate.review",
        "candidate.approve",
        "candidate.reject",
        "candidate.edit",
        "vote.cast",
        "vote.view",
        "vote.count",
        "vote.export",
        "voter.view",
        "voter.verify",
        "voter.manage",
        "committee.manage",
        "committee.view",
        "observer.manage",
        "observer.view",
        "audit.view",
        "audit.export",
        "user.create",
        "user.edit",
        "user.delete",
        "user.reset_password",
        "system.manage",
        "system.settings",
        "eligibility.manage",
      ],
    },
  },
} as const
