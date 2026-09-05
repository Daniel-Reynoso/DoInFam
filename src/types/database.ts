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
  public: {
    Tables: {
      families: {
        Row: {
          created_at: string
          id: string
          invite_code: string
          name: string
          timezone: string
          updated_at: string
          week_starts_on: number
        }
        Insert: {
          created_at?: string
          id: string
          invite_code?: string
          name: string
          timezone?: string
          updated_at?: string
          week_starts_on?: number
        }
        Update: {
          created_at?: string
          id?: string
          invite_code?: string
          name?: string
          timezone?: string
          updated_at?: string
          week_starts_on?: number
        }
        Relationships: []
      }
      family_auth_accounts: {
        Row: {
          created_at: string
          family_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          family_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          family_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_auth_accounts_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      family_members: {
        Row: {
          avatar_key: string
          created_at: string
          family_id: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          avatar_key?: string
          created_at?: string
          family_id: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          avatar_key?: string
          created_at?: string
          family_id?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      family_weeks: {
        Row: {
          consequence: string | null
          created_at: string
          family_id: string
          updated_at: string
          week_start: string
        }
        Insert: {
          consequence?: string | null
          created_at?: string
          family_id: string
          updated_at?: string
          week_start: string
        }
        Update: {
          consequence?: string | null
          created_at?: string
          family_id?: string
          updated_at?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_weeks_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      member_weekly_goals: {
        Row: {
          created_at: string
          family_id: string
          member_id: string
          target_points: number
          updated_at: string
          week_start: string
        }
        Insert: {
          created_at?: string
          family_id: string
          member_id: string
          target_points: number
          updated_at?: string
          week_start: string
        }
        Update: {
          created_at?: string
          family_id?: string
          member_id?: string
          target_points?: number
          updated_at?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_weekly_goals_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_weekly_goals_family_id_member_id_fkey"
            columns: ["family_id", "member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["family_id", "id"]
          },
        ]
      }
      task_completions: {
        Row: {
          completed_at: string
          family_id: string
          id: string
          member_id: string
          points_awarded: number
          task_id: string
          week_start: string
        }
        Insert: {
          completed_at?: string
          family_id: string
          id?: string
          member_id: string
          points_awarded: number
          task_id: string
          week_start: string
        }
        Update: {
          completed_at?: string
          family_id?: string
          id?: string
          member_id?: string
          points_awarded?: number
          task_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_completions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_completions_family_id_member_id_fkey"
            columns: ["family_id", "member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["family_id", "id"]
          },
          {
            foreignKeyName: "task_completions_family_id_task_id_fkey"
            columns: ["family_id", "task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["family_id", "id"]
          },
        ]
      }
      tasks: {
        Row: {
          created_at: string
          created_by_member_id: string | null
          description: string | null
          family_id: string
          id: string
          is_active: boolean
          points: number
          quota_per_period: number
          recurrence: Database["public"]["Enums"]["task_recurrence"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_member_id?: string | null
          description?: string | null
          family_id: string
          id?: string
          is_active?: boolean
          points: number
          quota_per_period?: number
          recurrence?: Database["public"]["Enums"]["task_recurrence"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_member_id?: string | null
          description?: string | null
          family_id?: string
          id?: string
          is_active?: boolean
          points?: number
          quota_per_period?: number
          recurrence?: Database["public"]["Enums"]["task_recurrence"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_family_id_created_by_member_id_fkey"
            columns: ["family_id", "created_by_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["family_id", "id"]
          },
          {
            foreignKeyName: "tasks_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      weekly_member_results: {
        Row: {
          consequence: string | null
          earned_points: number | null
          family_id: string | null
          goal_reached: boolean | null
          member_id: string | null
          member_name: string | null
          target_points: number | null
          week_start: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_weekly_goals_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_weekly_goals_family_id_member_id_fkey"
            columns: ["family_id", "member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["family_id", "id"]
          },
        ]
      }
    }
    Functions: {
      add_family_member: {
        Args: {
          p_avatar_key?: string
          p_name: string
          p_pin: string
          p_weekly_goal?: number
        }
        Returns: Json
      }
      clear_active_member: { Args: never; Returns: Json }
      complete_task: { Args: { p_task_id: string }; Returns: Json }
      delete_task_completion: { Args: { p_completion_id: string }; Returns: Json }
      create_family: {
        Args: {
          p_avatar_key?: string
          p_family_name: string
          p_first_member_name: string
          p_pin: string
          p_weekly_goal?: number
        }
        Returns: Json
      }
      create_member_profile: {
        Args: {
          p_avatar_key?: string
          p_name: string
          p_pin: string
          p_weekly_goal?: number
        }
        Returns: Json
      }
      create_task: {
        Args: {
          p_description: string
          p_points: number
          p_quota_per_period: number
          p_recurrence: Database["public"]["Enums"]["task_recurrence"]
          p_title: string
        }
        Returns: Json
      }
      deactivate_task: { Args: { p_task_id: string }; Returns: Json }
      get_active_member: { Args: never; Returns: Json }
      get_home_summary: { Args: never; Returns: Json }
      get_pending_weekly_closure: { Args: never; Returns: Json }
      join_family_by_code: { Args: { p_invite_code: string }; Returns: Json }
      mark_weekly_closure_seen: { Args: { p_week_start: string }; Returns: Json }
      select_member: {
        Args: { p_member_id: string; p_pin: string }
        Returns: Json
      }
      set_weekly_consequence: { Args: { p_consequence: string }; Returns: Json }
      set_weekly_goal: { Args: { p_target_points: number }; Returns: Json }
      update_family_settings: { Args: { p_name: string }; Returns: Json }
      update_member_profile: {
        Args: { p_avatar_key: string; p_name: string }
        Returns: Json
      }
      update_task: {
        Args: {
          p_description: string
          p_points: number
          p_quota_per_period: number
          p_recurrence: Database["public"]["Enums"]["task_recurrence"]
          p_task_id: string
          p_title: string
        }
        Returns: Json
      }
    }
    Enums: {
      task_recurrence: "daily" | "weekly" | "monthly"
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
  public: {
    Enums: {
      task_recurrence: ["daily", "weekly", "monthly"],
    },
  },
} as const
