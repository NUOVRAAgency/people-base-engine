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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      absence_decision_log: {
        Row: {
          absence_date: string
          attendance_id: string
          created_at: string
          decided_by: string | null
          employee_id: string
          from_decision: string
          id: string
          to_decision: string
        }
        Insert: {
          absence_date: string
          attendance_id: string
          created_at?: string
          decided_by?: string | null
          employee_id: string
          from_decision: string
          id?: string
          to_decision: string
        }
        Update: {
          absence_date?: string
          attendance_id?: string
          created_at?: string
          decided_by?: string | null
          employee_id?: string
          from_decision?: string
          id?: string
          to_decision?: string
        }
        Relationships: [
          {
            foreignKeyName: "absence_decision_log_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_decision_log_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      app_secrets: {
        Row: {
          id: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          id: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          id?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          company_name: string | null
          currency: string
          grace_minutes: number
          id: string
          late_rule_fraction: number
          late_rule_minutes: number
          logo_path: string | null
          updated_at: string
          updated_by: string | null
          weekend_days: number[]
          work_end: string
          work_start: string
        }
        Insert: {
          company_name?: string | null
          currency?: string
          grace_minutes?: number
          id?: string
          late_rule_fraction?: number
          late_rule_minutes?: number
          logo_path?: string | null
          updated_at?: string
          updated_by?: string | null
          weekend_days?: number[]
          work_end?: string
          work_start?: string
        }
        Update: {
          company_name?: string | null
          currency?: string
          grace_minutes?: number
          id?: string
          late_rule_fraction?: number
          late_rule_minutes?: number
          logo_path?: string | null
          updated_at?: string
          updated_by?: string | null
          weekend_days?: number[]
          work_end?: string
          work_start?: string
        }
        Relationships: []
      }
      attendance: {
        Row: {
          absence_decision: string
          check_in: string | null
          check_out: string | null
          created_at: string
          date: string
          decided_at: string | null
          decided_by: string | null
          employee_id: string
          id: string
          late_minutes: number
          note: string | null
          status: string
        }
        Insert: {
          absence_decision?: string
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date: string
          decided_at?: string | null
          decided_by?: string | null
          employee_id: string
          id?: string
          late_minutes?: number
          note?: string | null
          status: string
        }
        Update: {
          absence_decision?: string
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date?: string
          decided_at?: string | null
          decided_by?: string | null
          employee_id?: string
          id?: string
          late_minutes?: number
          note?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          created_at: string
          id: string
          location: string | null
          manager_employee_id: string | null
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          location?: string | null
          manager_employee_id?: string | null
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          location?: string | null
          manager_employee_id?: string | null
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_manager_employee_id_fkey"
            columns: ["manager_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_and_banks: {
        Row: {
          account_id: string
          bank_account_number: string | null
          branch_id: string | null
          created_at: string
          id: string
          is_active: boolean
          kind: string
          name: string
        }
        Insert: {
          account_id: string
          bank_account_number?: string | null
          branch_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          kind: string
          name: string
        }
        Update: {
          account_id?: string
          bank_account_number?: string | null
          branch_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_and_banks_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_and_banks_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_of_accounts: {
        Row: {
          account_type: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          is_parent: boolean
          name_ar: string
          name_en: string | null
          normal_side: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          account_type: string
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_parent?: boolean
          name_ar: string
          name_en?: string | null
          normal_side: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          account_type?: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_parent?: boolean
          name_ar?: string
          name_en?: string | null
          normal_side?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_centers: {
        Row: {
          branch_id: string | null
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          branch_id?: string | null
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          branch_id?: string | null
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_loans: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          monthly_installment: number
          note: string | null
          paid_amount: number
          start_month: string
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          monthly_installment: number
          note?: string | null
          paid_amount?: number
          start_month: string
          status?: string
          total_amount: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          monthly_installment?: number
          note?: string | null
          paid_amount?: number
          start_month?: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_loans_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_shifts: {
        Row: {
          cost_center_id: string | null
          created_at: string
          employee_id: string
          id: string
          shift_id: string
        }
        Insert: {
          cost_center_id?: string | null
          created_at?: string
          employee_id: string
          id?: string
          shift_id: string
        }
        Update: {
          cost_center_id?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          shift_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_shifts_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_shifts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_shifts_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "work_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          birth_date: string | null
          branch_id: string
          created_at: string
          department: string | null
          employee_number: string
          employment_type: string
          full_name: string
          full_name_en: string | null
          gender: string | null
          hire_date: string | null
          id: string
          manager_id: string | null
          national_id: string | null
          nationality: string | null
          phone: string | null
          position: string | null
          status: string
          updated_at: string
          work_email: string | null
        }
        Insert: {
          birth_date?: string | null
          branch_id: string
          created_at?: string
          department?: string | null
          employee_number?: string
          employment_type?: string
          full_name: string
          full_name_en?: string | null
          gender?: string | null
          hire_date?: string | null
          id?: string
          manager_id?: string | null
          national_id?: string | null
          nationality?: string | null
          phone?: string | null
          position?: string | null
          status?: string
          updated_at?: string
          work_email?: string | null
        }
        Update: {
          birth_date?: string | null
          branch_id?: string
          created_at?: string
          department?: string | null
          employee_number?: string
          employment_type?: string
          full_name?: string
          full_name_en?: string | null
          gender?: string | null
          hire_date?: string | null
          id?: string
          manager_id?: string | null
          national_id?: string | null
          nationality?: string | null
          phone?: string | null
          position?: string | null
          status?: string
          updated_at?: string
          work_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          entry_date: string
          entry_number: string
          id: string
          posted_at: string | null
          posted_by: string | null
          reverses_entry_id: string | null
          source: string
          status: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_date?: string
          entry_number?: string
          id?: string
          posted_at?: string | null
          posted_by?: string | null
          reverses_entry_id?: string | null
          source?: string
          status?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_date?: string
          entry_number?: string
          id?: string
          posted_at?: string | null
          posted_by?: string | null
          reverses_entry_id?: string | null
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_reverses_entry_id_fkey"
            columns: ["reverses_entry_id"]
            isOneToOne: true
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entry_lines: {
        Row: {
          account_id: string
          cost_center_id: string | null
          created_at: string
          credit: number
          debit: number
          id: string
          journal_entry_id: string
          memo: string | null
          rule_key: string | null
        }
        Insert: {
          account_id: string
          cost_center_id?: string | null
          created_at?: string
          credit?: number
          debit?: number
          id?: string
          journal_entry_id: string
          memo?: string | null
          rule_key?: string | null
        }
        Update: {
          account_id?: string
          cost_center_id?: string | null
          created_at?: string
          credit?: number
          debit?: number
          id?: string
          journal_entry_id?: string
          memo?: string | null
          rule_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          approved_by: string | null
          created_at: string
          employee_id: string
          end_date: string
          id: string
          leave_type: string
          leave_type_other: string | null
          reason: string | null
          requested_by: string | null
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          employee_id: string
          end_date: string
          id?: string
          leave_type?: string
          leave_type_other?: string | null
          reason?: string | null
          requested_by?: string | null
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          employee_id?: string
          end_date?: string
          id?: string
          leave_type?: string
          leave_type_other?: string | null
          reason?: string | null
          requested_by?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_vouchers: {
        Row: {
          amount: number
          branch_id: string | null
          cash_bank_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          journal_entry_id: string | null
          payroll_month: string | null
          source_journal_entry_id: string | null
          voucher_date: string
          voucher_number: string
        }
        Insert: {
          amount: number
          branch_id?: string | null
          cash_bank_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          journal_entry_id?: string | null
          payroll_month?: string | null
          source_journal_entry_id?: string | null
          voucher_date?: string
          voucher_number?: string
        }
        Update: {
          amount?: number
          branch_id?: string | null
          cash_bank_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          journal_entry_id?: string | null
          payroll_month?: string | null
          source_journal_entry_id?: string | null
          voucher_date?: string
          voucher_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_vouchers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_vouchers_cash_bank_id_fkey"
            columns: ["cash_bank_id"]
            isOneToOne: false
            referencedRelation: "cash_and_banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_vouchers_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: true
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_vouchers_source_journal_entry_id_fkey"
            columns: ["source_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll: {
        Row: {
          bank_name: string | null
          base_salary: number
          bonuses: number
          created_at: string
          deductions: number
          employee_id: string
          housing_allowance: number
          id: string
          month: string
          net_salary: number
          overtime_amount: number
          overtime_hours: number
          status: string
          transport_allowance: number
        }
        Insert: {
          bank_name?: string | null
          base_salary?: number
          bonuses?: number
          created_at?: string
          deductions?: number
          employee_id: string
          housing_allowance?: number
          id?: string
          month: string
          net_salary?: number
          overtime_amount?: number
          overtime_hours?: number
          status?: string
          transport_allowance?: number
        }
        Update: {
          bank_name?: string | null
          base_salary?: number
          bonuses?: number
          created_at?: string
          deductions?: number
          employee_id?: string
          housing_allowance?: number
          id?: string
          month?: string
          net_salary?: number
          overtime_amount?: number
          overtime_hours?: number
          status?: string
          transport_allowance?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_accounting_rules: {
        Row: {
          account_id: string
          description: string | null
          entry_side: string
          id: string
          is_active: boolean
          rule_key: string
          updated_at: string
        }
        Insert: {
          account_id: string
          description?: string | null
          entry_side: string
          id?: string
          is_active?: boolean
          rule_key: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          description?: string | null
          entry_side?: string
          id?: string
          is_active?: boolean
          rule_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_accounting_rules_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_adjustments: {
        Row: {
          amount: number
          attendance_id: string | null
          created_at: string
          employee_id: string
          id: string
          kind: string
          label: string
          month: string
          note: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          attendance_id?: string | null
          created_at?: string
          employee_id: string
          id?: string
          kind: string
          label: string
          month: string
          note?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          attendance_id?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          kind?: string
          label?: string
          month?: string
          note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_adjustments_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: true
            referencedRelation: "attendance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_adjustments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_journal_links: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          id: string
          is_reversed: boolean
          journal_entry_id: string
          payroll_month: string
          reversed_at: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_reversed?: boolean
          journal_entry_id: string
          payroll_month: string
          reversed_at?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_reversed?: boolean
          journal_entry_id?: string
          payroll_month?: string
          reversed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_journal_links_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_journal_links_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: true
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          content: string | null
          generated_at: string
          id: string
          month: string | null
        }
        Insert: {
          content?: string | null
          generated_at?: string
          id?: string
          month?: string | null
        }
        Update: {
          content?: string | null
          generated_at?: string
          id?: string
          month?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar_path: string | null
          branch_id: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          must_change_password: boolean
        }
        Insert: {
          avatar_path?: string | null
          branch_id?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean
          must_change_password?: boolean
        }
        Update: {
          avatar_path?: string | null
          branch_id?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          must_change_password?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "users_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      work_shifts: {
        Row: {
          created_at: string
          early_leave_minutes: number
          end_time: string
          grace_minutes: number
          id: string
          is_active: boolean
          missing_checkout_rule: string
          name: string
          start_time: string
        }
        Insert: {
          created_at?: string
          early_leave_minutes?: number
          end_time: string
          grace_minutes?: number
          id?: string
          is_active?: boolean
          missing_checkout_rule?: string
          name: string
          start_time: string
        }
        Update: {
          created_at?: string
          early_leave_minutes?: number
          end_time?: string
          grace_minutes?: number
          id?: string
          is_active?: boolean
          missing_checkout_rule?: string
          name?: string
          start_time?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_net_salary: {
        Args: {
          _base_salary: number
          _bonuses?: number
          _deductions?: number
          _employee_id: string
          _month: string
        }
        Returns: number
      }
      has_approved_leave: {
        Args: { _date: string; _employee_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role_name: {
        Args: { _role: string; _user_id: string }
        Returns: boolean
      }
      monthly_attendance_rate: {
        Args: { _employee_id: string; _month: string }
        Returns: number
      }
      set_absence_decision: {
        Args: { _attendance_id: string; _decision: string }
        Returns: string
      }
      unjustified_absent_days: {
        Args: { _employee_id: string; _month: string }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "viewer" | "operator"
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
      app_role: ["admin", "viewer", "operator"],
    },
  },
} as const
