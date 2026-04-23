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
      activities: {
        Row: {
          created_at: string | null
          id: string
          kind: string
          org_id: string
          payload: Json | null
          record_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          kind: string
          org_id: string
          payload?: Json | null
          record_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          kind?: string
          org_id?: string
          payload?: Json | null
          record_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "records"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_runs: {
        Row: {
          agent_id: string | null
          agent_name: string
          created_at: string | null
          duration_ms: number | null
          error: string | null
          id: string
          input: Json | null
          model: string | null
          org_id: string
          output: Json | null
          status: string | null
          subject_external_id: string | null
          subject_kind: string
          tokens_in: number | null
          tokens_out: number | null
        }
        Insert: {
          agent_id?: string | null
          agent_name: string
          created_at?: string | null
          duration_ms?: number | null
          error?: string | null
          id?: string
          input?: Json | null
          model?: string | null
          org_id: string
          output?: Json | null
          status?: string | null
          subject_external_id?: string | null
          subject_kind: string
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Update: {
          agent_id?: string | null
          agent_name?: string
          created_at?: string | null
          duration_ms?: number | null
          error?: string | null
          id?: string
          input?: Json | null
          model?: string | null
          org_id?: string
          output?: Json | null
          status?: string | null
          subject_external_id?: string | null
          subject_kind?: string
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          created_at: string | null
          id: string
          model: string
          name: string
          org_id: string
          system_prompt: string
          tools: string[] | null
          triggers: Json | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          model?: string
          name: string
          org_id: string
          system_prompt: string
          tools?: string[] | null
          triggers?: Json | null
        }
        Update: {
          created_at?: string | null
          id?: string
          model?: string
          name?: string
          org_id?: string
          system_prompt?: string
          tools?: string[] | null
          triggers?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "agents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          cost_estimate: number | null
          created_at: string | null
          id: string
          org_id: string
          tokens_in: number | null
          tokens_out: number | null
          tool: string | null
          user_id: string | null
        }
        Insert: {
          cost_estimate?: number | null
          created_at?: string | null
          id?: string
          org_id: string
          tokens_in?: number | null
          tokens_out?: number | null
          tool?: string | null
          user_id?: string | null
        }
        Update: {
          cost_estimate?: number | null
          created_at?: string | null
          id?: string
          org_id?: string
          tokens_in?: number | null
          tokens_out?: number | null
          tool?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string | null
          id: string
          key_hash: string
          name: string
          org_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          key_hash: string
          name: string
          org_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          key_hash?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          automation_id: string
          error: string | null
          event_id: string
          finished_at: string | null
          id: string
          started_at: string | null
          status: string
        }
        Insert: {
          automation_id: string
          error?: string | null
          event_id: string
          finished_at?: string | null
          id?: string
          started_at?: string | null
          status: string
        }
        Update: {
          automation_id?: string
          error?: string | null
          event_id?: string
          finished_at?: string | null
          id?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          actions_json: Json | null
          conditions_json: Json | null
          created_at: string | null
          enabled: boolean | null
          id: string
          name: string
          org_id: string
          trigger: string
        }
        Insert: {
          actions_json?: Json | null
          conditions_json?: Json | null
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          name: string
          org_id: string
          trigger: string
        }
        Update: {
          actions_json?: Json | null
          conditions_json?: Json | null
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          name?: string
          org_id?: string
          trigger?: string
        }
        Relationships: [
          {
            foreignKeyName: "automations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          brand_code: string
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          org_id: string
          phone: string | null
        }
        Insert: {
          address?: string | null
          brand_code: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          org_id: string
          phone?: string | null
        }
        Update: {
          address?: string | null
          brand_code?: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          org_id?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean | null
          branch_id: string | null
          color: string | null
          created_at: string | null
          ends_at: string
          event_type: string | null
          id: string
          kind: string
          location: string | null
          org_id: string
          owner_id: string | null
          related_id: string | null
          related_type: string | null
          starts_at: string
          title: string
        }
        Insert: {
          all_day?: boolean | null
          branch_id?: string | null
          color?: string | null
          created_at?: string | null
          ends_at: string
          event_type?: string | null
          id?: string
          kind: string
          location?: string | null
          org_id: string
          owner_id?: string | null
          related_id?: string | null
          related_type?: string | null
          starts_at: string
          title: string
        }
        Update: {
          all_day?: boolean | null
          branch_id?: string | null
          color?: string | null
          created_at?: string | null
          ends_at?: string
          event_type?: string | null
          id?: string
          kind?: string
          location?: string | null
          org_id?: string
          owner_id?: string | null
          related_id?: string | null
          related_type?: string | null
          starts_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      call_coaching: {
        Row: {
          agent_ext: string | null
          call_id: string | null
          coach_notes: string | null
          created_at: string | null
          id: string
          org_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          rubric_json: Json | null
          score: number | null
        }
        Insert: {
          agent_ext?: string | null
          call_id?: string | null
          coach_notes?: string | null
          created_at?: string | null
          id?: string
          org_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          rubric_json?: Json | null
          score?: number | null
        }
        Update: {
          agent_ext?: string | null
          call_id?: string | null
          coach_notes?: string | null
          created_at?: string | null
          id?: string
          org_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          rubric_json?: Json | null
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "call_coaching_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          amount: number | null
          customer_id: string | null
          id: string
          job_id: string | null
          opened_at: string | null
          org_id: string
          status: string | null
        }
        Insert: {
          amount?: number | null
          customer_id?: string | null
          id?: string
          job_id?: string | null
          opened_at?: string | null
          org_id: string
          status?: string | null
        }
        Update: {
          amount?: number | null
          customer_id?: string | null
          id?: string
          job_id?: string | null
          opened_at?: string | null
          org_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claims_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      crews: {
        Row: {
          capacity: number | null
          id: string
          name: string
          org_id: string
        }
        Insert: {
          capacity?: number | null
          id?: string
          name: string
          org_id: string
        }
        Update: {
          capacity?: number | null
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crews_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address_json: Json | null
          balance: number | null
          brand: string | null
          created_at: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          display_name: string | null
          first_seen: string | null
          id: string
          last_seen: string | null
          latest_assigned_to: string | null
          org_id: string
          raw_data: Json | null
          sm_id: string | null
          source: string | null
          status: string | null
          stripe_customer_id: string | null
          tags: string[] | null
          total_calls: number | null
          updated_at: string | null
          upstream_id: string | null
        }
        Insert: {
          address_json?: Json | null
          balance?: number | null
          brand?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          display_name?: string | null
          first_seen?: string | null
          id?: string
          last_seen?: string | null
          latest_assigned_to?: string | null
          org_id: string
          raw_data?: Json | null
          sm_id?: string | null
          source?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          tags?: string[] | null
          total_calls?: number | null
          updated_at?: string | null
          upstream_id?: string | null
        }
        Update: {
          address_json?: Json | null
          balance?: number | null
          brand?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          display_name?: string | null
          first_seen?: string | null
          id?: string
          last_seen?: string | null
          latest_assigned_to?: string | null
          org_id?: string
          raw_data?: Json | null
          sm_id?: string | null
          source?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          tags?: string[] | null
          total_calls?: number | null
          updated_at?: string | null
          upstream_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      distance_cache: {
        Row: {
          dest_key: string
          duration_seconds: number | null
          fetched_at: string
          id: string
          miles: number
          origin_key: string
          provider: string
        }
        Insert: {
          dest_key: string
          duration_seconds?: number | null
          fetched_at?: string
          id?: string
          miles: number
          origin_key: string
          provider?: string
        }
        Update: {
          dest_key?: string
          duration_seconds?: number | null
          fetched_at?: string
          id?: string
          miles?: number
          origin_key?: string
          provider?: string
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          body: string | null
          customer_id: string | null
          from_email: string | null
          id: string
          org_id: string
          related_id: string | null
          related_type: string | null
          sent_at: string | null
          status: string | null
          subject: string | null
          template_key: string | null
          to_email: string | null
        }
        Insert: {
          body?: string | null
          customer_id?: string | null
          from_email?: string | null
          id?: string
          org_id: string
          related_id?: string | null
          related_type?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          template_key?: string | null
          to_email?: string | null
        }
        Update: {
          body?: string | null
          customer_id?: string | null
          from_email?: string | null
          id?: string
          org_id?: string
          related_id?: string | null
          related_type?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          template_key?: string | null
          to_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      embeddings: {
        Row: {
          content: string
          embedding: string | null
          id: string
          org_id: string
          record_id: string | null
        }
        Insert: {
          content: string
          embedding?: string | null
          id?: string
          org_id: string
          record_id?: string | null
        }
        Update: {
          content?: string
          embedding?: string | null
          id?: string
          org_id?: string
          record_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "embeddings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embeddings_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "records"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_signatures: {
        Row: {
          estimate_id: string
          id: string
          ip_address: string | null
          org_id: string
          signature_data: string
          signed_at: string | null
          signer_email: string | null
          signer_name: string
        }
        Insert: {
          estimate_id: string
          id?: string
          ip_address?: string | null
          org_id: string
          signature_data: string
          signed_at?: string | null
          signer_email?: string | null
          signer_name: string
        }
        Update: {
          estimate_id?: string
          id?: string
          ip_address?: string | null
          org_id?: string
          signature_data?: string
          signed_at?: string | null
          signer_email?: string | null
          signer_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_signatures_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: true
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_signatures_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      estimates: {
        Row: {
          accepted_at: string | null
          amount: number | null
          auto_generated: boolean
          charges_json: Json | null
          created_at: string | null
          declined_at: string | null
          deposit_amount: number | null
          deposit_paid_at: string | null
          discounts: number | null
          estimate_number: string | null
          estimate_type: string | null
          id: string
          inventory_snapshot: Json | null
          opportunity_id: string
          org_id: string
          pdf_url: string | null
          pricing_mode: string | null
          sales_tax: number | null
          sent_at: string | null
          subtotal: number | null
          tariff_id: string | null
          tariff_snapshot: Json | null
          token_epoch: number
          valid_until: string | null
        }
        Insert: {
          accepted_at?: string | null
          amount?: number | null
          auto_generated?: boolean
          charges_json?: Json | null
          created_at?: string | null
          declined_at?: string | null
          deposit_amount?: number | null
          deposit_paid_at?: string | null
          discounts?: number | null
          estimate_number?: string | null
          estimate_type?: string | null
          id?: string
          inventory_snapshot?: Json | null
          opportunity_id: string
          org_id: string
          pdf_url?: string | null
          pricing_mode?: string | null
          sales_tax?: number | null
          sent_at?: string | null
          subtotal?: number | null
          tariff_id?: string | null
          tariff_snapshot?: Json | null
          token_epoch?: number
          valid_until?: string | null
        }
        Update: {
          accepted_at?: string | null
          amount?: number | null
          auto_generated?: boolean
          charges_json?: Json | null
          created_at?: string | null
          declined_at?: string | null
          deposit_amount?: number | null
          deposit_paid_at?: string | null
          discounts?: number | null
          estimate_number?: string | null
          estimate_type?: string | null
          id?: string
          inventory_snapshot?: Json | null
          opportunity_id?: string
          org_id?: string
          pdf_url?: string | null
          pricing_mode?: string | null
          sales_tax?: number | null
          sent_at?: string | null
          subtotal?: number | null
          tariff_id?: string | null
          tariff_snapshot?: Json | null
          token_epoch?: number
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estimates_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      estimator_branch_config: {
        Row: {
          brand_code: string
          burdened_hourly: number
          burdened_per_worker_hour: number | null
          deadhead_cost_per_mile: number
          default_fuel_surcharge_pct: number
          default_long_haul_prep_fee: number
          default_shuttle_fee: number
          default_specialty_fee: number
          default_tv_crating_fee: number
          id: string
          is_placeholder: boolean
          linehaul_rate_custom_per_lb: number | null
          linehaul_rate_mode: string
          notes: string | null
          org_id: string
          rate_base_2man_1truck: number | null
          rate_per_extra_man: number | null
          rate_per_extra_truck: number | null
          sales_tax_pct: number
          truck_cost_per_hour: number | null
          updated_at: string
          wage_average_per_hour: number | null
        }
        Insert: {
          brand_code: string
          burdened_hourly?: number
          burdened_per_worker_hour?: number | null
          deadhead_cost_per_mile?: number
          default_fuel_surcharge_pct?: number
          default_long_haul_prep_fee?: number
          default_shuttle_fee?: number
          default_specialty_fee?: number
          default_tv_crating_fee?: number
          id?: string
          is_placeholder?: boolean
          linehaul_rate_custom_per_lb?: number | null
          linehaul_rate_mode?: string
          notes?: string | null
          org_id: string
          rate_base_2man_1truck?: number | null
          rate_per_extra_man?: number | null
          rate_per_extra_truck?: number | null
          sales_tax_pct?: number
          truck_cost_per_hour?: number | null
          updated_at?: string
          wage_average_per_hour?: number | null
        }
        Update: {
          brand_code?: string
          burdened_hourly?: number
          burdened_per_worker_hour?: number | null
          deadhead_cost_per_mile?: number
          default_fuel_surcharge_pct?: number
          default_long_haul_prep_fee?: number
          default_shuttle_fee?: number
          default_specialty_fee?: number
          default_tv_crating_fee?: number
          id?: string
          is_placeholder?: boolean
          linehaul_rate_custom_per_lb?: number | null
          linehaul_rate_mode?: string
          notes?: string | null
          org_id?: string
          rate_base_2man_1truck?: number | null
          rate_per_extra_man?: number | null
          rate_per_extra_truck?: number | null
          sales_tax_pct?: number
          truck_cost_per_hour?: number | null
          updated_at?: string
          wage_average_per_hour?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "estimator_branch_config_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      estimator_predictions: {
        Row: {
          amount_delta_pct: number | null
          brand_code: string
          comparable_sample_n: number | null
          confidence: number | null
          created_at: string
          deadhead_skipped: boolean | null
          driveway_flags: Json | null
          driveway_review_required: boolean | null
          edited_by_agent: boolean
          estimate_id: string | null
          final_amount: number | null
          final_captured_at: string | null
          final_charges_json: Json | null
          final_subtotal: number | null
          id: string
          inputs_json: Json
          margin_pct: number | null
          margin_status: string | null
          opportunity_id: string | null
          org_id: string
          predicted_amount: number | null
          prediction_json: Json
          pricing_mode: string
          source_call_id: string | null
        }
        Insert: {
          amount_delta_pct?: number | null
          brand_code?: string
          comparable_sample_n?: number | null
          confidence?: number | null
          created_at?: string
          deadhead_skipped?: boolean | null
          driveway_flags?: Json | null
          driveway_review_required?: boolean | null
          edited_by_agent?: boolean
          estimate_id?: string | null
          final_amount?: number | null
          final_captured_at?: string | null
          final_charges_json?: Json | null
          final_subtotal?: number | null
          id?: string
          inputs_json: Json
          margin_pct?: number | null
          margin_status?: string | null
          opportunity_id?: string | null
          org_id: string
          predicted_amount?: number | null
          prediction_json: Json
          pricing_mode: string
          source_call_id?: string | null
        }
        Update: {
          amount_delta_pct?: number | null
          brand_code?: string
          comparable_sample_n?: number | null
          confidence?: number | null
          created_at?: string
          deadhead_skipped?: boolean | null
          driveway_flags?: Json | null
          driveway_review_required?: boolean | null
          edited_by_agent?: boolean
          estimate_id?: string | null
          final_amount?: number | null
          final_captured_at?: string | null
          final_charges_json?: Json | null
          final_subtotal?: number | null
          id?: string
          inputs_json?: Json
          margin_pct?: number | null
          margin_status?: string | null
          opportunity_id?: string | null
          org_id?: string
          predicted_amount?: number | null
          prediction_json?: Json
          pricing_mode?: string
          source_call_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estimator_predictions_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimator_predictions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimator_predictions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string | null
          id: string
          org_id: string
          payload: Json | null
          processed_at: string | null
          related_id: string | null
          related_type: string | null
          type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          org_id: string
          payload?: Json | null
          processed_at?: string | null
          related_id?: string | null
          related_type?: string | null
          type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          org_id?: string
          payload?: Json | null
          processed_at?: string | null
          related_id?: string | null
          related_type?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      fields: {
        Row: {
          config: Json | null
          id: string
          key: string
          label: string
          object_id: string
          type: string
        }
        Insert: {
          config?: Json | null
          id?: string
          key: string
          label: string
          object_id: string
          type: string
        }
        Update: {
          config?: Json | null
          id?: string
          key?: string
          label?: string
          object_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fields_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "objects"
            referencedColumns: ["id"]
          },
        ]
      }
      historical_jobs: {
        Row: {
          access_json: Json | null
          actual_margin_pct: number | null
          billed_hours: number | null
          brand_code: string
          crating_fees: number | null
          crew_size: number | null
          deadhead_miles: number | null
          declared_value: number | null
          dest_state: string | null
          dest_zip: string | null
          fuel_surcharge_pct: number | null
          id: string
          inventory_json: Json | null
          linehaul_rate_per_lb: number | null
          long_haul_prep_fee: number | null
          materials_json: Json | null
          move_category: string
          org_id: string
          origin_state: string | null
          origin_zip: string | null
          pricing_mode: string
          raw_payload: Json
          service_date: string | null
          shuttle_fee: number | null
          sm_opportunity_id: string
          synced_at: string
          total_amount: number | null
          total_cu_ft: number | null
          total_miles: number | null
          total_weight_lb: number | null
          truck_size: string | null
          valuation_type: string | null
        }
        Insert: {
          access_json?: Json | null
          actual_margin_pct?: number | null
          billed_hours?: number | null
          brand_code?: string
          crating_fees?: number | null
          crew_size?: number | null
          deadhead_miles?: number | null
          declared_value?: number | null
          dest_state?: string | null
          dest_zip?: string | null
          fuel_surcharge_pct?: number | null
          id?: string
          inventory_json?: Json | null
          linehaul_rate_per_lb?: number | null
          long_haul_prep_fee?: number | null
          materials_json?: Json | null
          move_category: string
          org_id: string
          origin_state?: string | null
          origin_zip?: string | null
          pricing_mode?: string
          raw_payload: Json
          service_date?: string | null
          shuttle_fee?: number | null
          sm_opportunity_id: string
          synced_at?: string
          total_amount?: number | null
          total_cu_ft?: number | null
          total_miles?: number | null
          total_weight_lb?: number | null
          truck_size?: string | null
          valuation_type?: string | null
        }
        Update: {
          access_json?: Json | null
          actual_margin_pct?: number | null
          billed_hours?: number | null
          brand_code?: string
          crating_fees?: number | null
          crew_size?: number | null
          deadhead_miles?: number | null
          declared_value?: number | null
          dest_state?: string | null
          dest_zip?: string | null
          fuel_surcharge_pct?: number | null
          id?: string
          inventory_json?: Json | null
          linehaul_rate_per_lb?: number | null
          long_haul_prep_fee?: number | null
          materials_json?: Json | null
          move_category?: string
          org_id?: string
          origin_state?: string | null
          origin_zip?: string | null
          pricing_mode?: string
          raw_payload?: Json
          service_date?: string | null
          shuttle_fee?: number | null
          sm_opportunity_id?: string
          synced_at?: string
          total_amount?: number | null
          total_cu_ft?: number | null
          total_miles?: number | null
          total_weight_lb?: number | null
          truck_size?: string | null
          valuation_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historical_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_credentials: {
        Row: {
          config: Json | null
          created_at: string | null
          enabled: boolean | null
          id: string
          org_id: string
          provider_key: string
          secrets: Json | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          org_id: string
          provider_key: string
          secrets?: Json | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          org_id?: string
          provider_key?: string
          secrets?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_credentials_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          config: Json | null
          created_at: string | null
          enabled: boolean | null
          id: string
          mode: string
          org_id: string
          plugin_key: string
          secrets: Json | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          mode: string
          org_id: string
          plugin_key: string
          secrets?: Json | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          mode?: string
          org_id?: string
          plugin_key?: string
          secrets?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "integrations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          created_at: string | null
          cubic_feet: number | null
          id: string
          is_heavy: boolean | null
          item_name: string
          notes: string | null
          opportunity_id: string
          org_id: string
          quantity: number | null
          room_name: string
          weight_lbs: number | null
        }
        Insert: {
          created_at?: string | null
          cubic_feet?: number | null
          id?: string
          is_heavy?: boolean | null
          item_name: string
          notes?: string | null
          opportunity_id: string
          org_id: string
          quantity?: number | null
          room_name: string
          weight_lbs?: number | null
        }
        Update: {
          created_at?: string | null
          cubic_feet?: number | null
          id?: string
          is_heavy?: boolean | null
          item_name?: string
          notes?: string | null
          opportunity_id?: string
          org_id?: string
          quantity?: number | null
          room_name?: string
          weight_lbs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_due: number | null
          amount_paid: number | null
          balance: number | null
          created_at: string | null
          customer_id: string | null
          discounts: number | null
          due_date: string | null
          estimate_id: string | null
          id: string
          invoice_number: string | null
          issued_at: string | null
          job_id: string | null
          line_items_json: Json | null
          notes: string | null
          opportunity_id: string | null
          org_id: string
          paid_at: string | null
          payment_method: string | null
          payment_reference: string | null
          pdf_url: string | null
          sales_tax: number | null
          status: string
          subtotal: number | null
          updated_at: string | null
        }
        Insert: {
          amount_due?: number | null
          amount_paid?: number | null
          balance?: number | null
          created_at?: string | null
          customer_id?: string | null
          discounts?: number | null
          due_date?: string | null
          estimate_id?: string | null
          id?: string
          invoice_number?: string | null
          issued_at?: string | null
          job_id?: string | null
          line_items_json?: Json | null
          notes?: string | null
          opportunity_id?: string | null
          org_id: string
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          pdf_url?: string | null
          sales_tax?: number | null
          status?: string
          subtotal?: number | null
          updated_at?: string | null
        }
        Update: {
          amount_due?: number | null
          amount_paid?: number | null
          balance?: number | null
          created_at?: string | null
          customer_id?: string | null
          discounts?: number | null
          due_date?: string | null
          estimate_id?: string | null
          id?: string
          invoice_number?: string | null
          issued_at?: string | null
          job_id?: string | null
          line_items_json?: Json | null
          notes?: string | null
          opportunity_id?: string | null
          org_id?: string
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          pdf_url?: string | null
          sales_tax?: number | null
          status?: string
          subtotal?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
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
            foreignKeyName: "invoices_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          amount: number | null
          arrival_window: string | null
          billed: number | null
          branch_id: string | null
          created_at: string | null
          crew_size: number | null
          customer_id: string | null
          customer_name: string | null
          id: string
          opportunity_id: string | null
          org_id: string
          quote_number: string | null
          service_date: string | null
          service_type: string | null
          status: string
          truck_ids: string[] | null
        }
        Insert: {
          amount?: number | null
          arrival_window?: string | null
          billed?: number | null
          branch_id?: string | null
          created_at?: string | null
          crew_size?: number | null
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          opportunity_id?: string | null
          org_id: string
          quote_number?: string | null
          service_date?: string | null
          service_type?: string | null
          status?: string
          truck_ids?: string[] | null
        }
        Update: {
          amount?: number | null
          arrival_window?: string | null
          billed?: number | null
          branch_id?: string | null
          created_at?: string | null
          crew_size?: number | null
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          opportunity_id?: string | null
          org_id?: string
          quote_number?: string | null
          service_date?: string | null
          service_type?: string | null
          status?: string
          truck_ids?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      margin_policies: {
        Row: {
          brand_code: string
          id: string
          min_margin_pct: number
          move_class: string
          org_id: string
          target_margin_pct: number
          updated_at: string
        }
        Insert: {
          brand_code?: string
          id?: string
          min_margin_pct: number
          move_class: string
          org_id: string
          target_margin_pct: number
          updated_at?: string
        }
        Update: {
          brand_code?: string
          id?: string
          min_margin_pct?: number
          move_class?: string
          org_id?: string
          target_margin_pct?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "margin_policies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      material_patterns: {
        Row: {
          brand_code: string
          id: string
          move_category: string
          org_id: string
          qty_median: number | null
          qty_p75: number | null
          refreshed_at: string
          sample_n: number
          sku: string
          unit_price_median: number | null
        }
        Insert: {
          brand_code?: string
          id?: string
          move_category: string
          org_id: string
          qty_median?: number | null
          qty_p75?: number | null
          refreshed_at?: string
          sample_n?: number
          sku: string
          unit_price_median?: number | null
        }
        Update: {
          brand_code?: string
          id?: string
          move_category?: string
          org_id?: string
          qty_median?: number | null
          qty_p75?: number | null
          refreshed_at?: string
          sample_n?: number
          sku?: string
          unit_price_median?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "material_patterns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string | null
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string | null
          org_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string | null
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      move_size_stats: {
        Row: {
          amount_p25: number | null
          amount_p50: number | null
          amount_p75: number | null
          brand_code: string
          crew_mode: number | null
          distance_bucket: string
          fuel_surcharge_pct_median: number | null
          hours_p25: number | null
          hours_p50: number | null
          hours_p75: number | null
          id: string
          linehaul_rate_median: number | null
          move_category: string
          org_id: string
          pricing_mode: string
          refreshed_at: string
          sample_n: number
          season: string
          truck_mode: string | null
          weight_per_cuft_median: number | null
        }
        Insert: {
          amount_p25?: number | null
          amount_p50?: number | null
          amount_p75?: number | null
          brand_code?: string
          crew_mode?: number | null
          distance_bucket: string
          fuel_surcharge_pct_median?: number | null
          hours_p25?: number | null
          hours_p50?: number | null
          hours_p75?: number | null
          id?: string
          linehaul_rate_median?: number | null
          move_category: string
          org_id: string
          pricing_mode: string
          refreshed_at?: string
          sample_n?: number
          season: string
          truck_mode?: string | null
          weight_per_cuft_median?: number | null
        }
        Update: {
          amount_p25?: number | null
          amount_p50?: number | null
          amount_p75?: number | null
          brand_code?: string
          crew_mode?: number | null
          distance_bucket?: string
          fuel_surcharge_pct_median?: number | null
          hours_p25?: number | null
          hours_p50?: number | null
          hours_p75?: number | null
          id?: string
          linehaul_rate_median?: number | null
          move_category?: string
          org_id?: string
          pricing_mode?: string
          refreshed_at?: string
          sample_n?: number
          season?: string
          truck_mode?: string | null
          weight_per_cuft_median?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "move_size_stats_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string | null
          id: string
          kind: string | null
          link: string | null
          org_id: string
          read_at: string | null
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          id?: string
          kind?: string | null
          link?: string | null
          org_id: string
          read_at?: string | null
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string | null
          id?: string
          kind?: string | null
          link?: string | null
          org_id?: string
          read_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      objects: {
        Row: {
          created_at: string | null
          id: string
          is_system: boolean | null
          key: string
          label: string
          org_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_system?: boolean | null
          key: string
          label: string
          org_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_system?: boolean | null
          key?: string
          label?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "objects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_fee_patterns: {
        Row: {
          brand_code: string
          fee_type: string
          id: string
          median: number | null
          move_class: string
          org_id: string
          p75: number | null
          refreshed_at: string
          sample_n: number
        }
        Insert: {
          brand_code?: string
          fee_type: string
          id?: string
          median?: number | null
          move_class: string
          org_id: string
          p75?: number | null
          refreshed_at?: string
          sample_n?: number
        }
        Update: {
          brand_code?: string
          fee_type?: string
          id?: string
          median?: number | null
          move_class?: string
          org_id?: string
          p75?: number | null
          refreshed_at?: string
          sample_n?: number
        }
        Relationships: [
          {
            foreignKeyName: "operational_fee_patterns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          age_days: number | null
          amount: number | null
          assigned_to: string | null
          branch_id: string | null
          brand: string | null
          brand_code: string | null
          created_at: string | null
          customer_id: string | null
          destination_json: Json | null
          extracted_inventory_json: Json | null
          id: string
          intent: string | null
          inventory_extracted_at: string | null
          inventory_extraction_confidence: number | null
          last_activity_at: string | null
          lead_quality: string | null
          move_size: string | null
          move_type: string | null
          opportunity_type: string | null
          org_id: string
          origin_json: Json | null
          quote_number: string | null
          raw_data: Json | null
          sentiment: string | null
          service_date: string | null
          service_type: string | null
          sm_id: string | null
          sm_url: string | null
          source: string | null
          source_call_id: string | null
          status: string
          updated_at: string | null
          upstream_id: string | null
        }
        Insert: {
          age_days?: number | null
          amount?: number | null
          assigned_to?: string | null
          branch_id?: string | null
          brand?: string | null
          brand_code?: string | null
          created_at?: string | null
          customer_id?: string | null
          destination_json?: Json | null
          extracted_inventory_json?: Json | null
          id?: string
          intent?: string | null
          inventory_extracted_at?: string | null
          inventory_extraction_confidence?: number | null
          last_activity_at?: string | null
          lead_quality?: string | null
          move_size?: string | null
          move_type?: string | null
          opportunity_type?: string | null
          org_id: string
          origin_json?: Json | null
          quote_number?: string | null
          raw_data?: Json | null
          sentiment?: string | null
          service_date?: string | null
          service_type?: string | null
          sm_id?: string | null
          sm_url?: string | null
          source?: string | null
          source_call_id?: string | null
          status?: string
          updated_at?: string | null
          upstream_id?: string | null
        }
        Update: {
          age_days?: number | null
          amount?: number | null
          assigned_to?: string | null
          branch_id?: string | null
          brand?: string | null
          brand_code?: string | null
          created_at?: string | null
          customer_id?: string | null
          destination_json?: Json | null
          extracted_inventory_json?: Json | null
          id?: string
          intent?: string | null
          inventory_extracted_at?: string | null
          inventory_extraction_confidence?: number | null
          last_activity_at?: string | null
          lead_quality?: string | null
          move_size?: string | null
          move_type?: string | null
          opportunity_type?: string | null
          org_id?: string
          origin_json?: Json | null
          quote_number?: string | null
          raw_data?: Json | null
          sentiment?: string | null
          service_date?: string | null
          service_type?: string | null
          sm_id?: string | null
          sm_url?: string | null
          source?: string | null
          source_call_id?: string | null
          status?: string
          updated_at?: string | null
          upstream_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          plan: string
          slug: string
          updated_at: string
          upstream_company_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          plan?: string
          slug: string
          updated_at?: string
          upstream_company_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          plan?: string
          slug?: string
          updated_at?: string
          upstream_company_id?: string | null
        }
        Relationships: []
      }
      orgs: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          customer_id: string | null
          estimate_id: string | null
          id: string
          invoice_id: string | null
          method: string
          org_id: string
          processed_at: string | null
          reference: string | null
          status: string
          stripe_payment_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          customer_id?: string | null
          estimate_id?: string | null
          id?: string
          invoice_id?: string | null
          method: string
          org_id: string
          processed_at?: string | null
          reference?: string | null
          status?: string
          stripe_payment_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          customer_id?: string | null
          estimate_id?: string | null
          id?: string
          invoice_id?: string | null
          method?: string
          org_id?: string
          processed_at?: string | null
          reference?: string | null
          status?: string
          stripe_payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          id: string
          name: string
          object_key: string
          org_id: string
        }
        Insert: {
          id?: string
          name: string
          object_key?: string
          org_id: string
        }
        Update: {
          id?: string
          name?: string
          object_key?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipelines_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      plugins: {
        Row: {
          id: string
          installed_at: string | null
          key: string
          manifest: Json
          org_id: string
        }
        Insert: {
          id?: string
          installed_at?: string | null
          key: string
          manifest: Json
          org_id: string
        }
        Update: {
          id?: string
          installed_at?: string | null
          key?: string
          manifest?: Json
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plugins_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      records: {
        Row: {
          created_at: string | null
          data: Json
          id: string
          object_id: string
          org_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data?: Json
          id?: string
          object_id: string
          org_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data?: Json
          id?: string
          object_id?: string
          org_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "records_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "records_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      relations: {
        Row: {
          from_record: string
          id: string
          kind: string
          org_id: string
          to_record: string
        }
        Insert: {
          from_record: string
          id?: string
          kind: string
          org_id: string
          to_record: string
        }
        Update: {
          from_record?: string
          id?: string
          kind?: string
          org_id?: string
          to_record?: string
        }
        Relationships: [
          {
            foreignKeyName: "relations_from_record_fkey"
            columns: ["from_record"]
            isOneToOne: false
            referencedRelation: "records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relations_to_record_fkey"
            columns: ["to_record"]
            isOneToOne: false
            referencedRelation: "records"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          category: string
          created_at: string | null
          id: string
          key: string
          org_id: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: string
          key: string
          org_id: string
          updated_at?: string | null
          value?: Json
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          key?: string
          org_id?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          address: string
          brand_code: string | null
          created_at: string
          id: string
          is_active: boolean
          lat: number | null
          lng: number | null
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          address: string
          brand_code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          address?: string
          brand_code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shops_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sm_sync_cursor: {
        Row: {
          brand_code: string
          completed_at: string | null
          fetched_count: number
          id: string
          last_error: string | null
          last_offset: number
          last_sm_opportunity_id: string | null
          move_category: string
          org_id: string
          started_at: string | null
          status: string
          target_count: number
          updated_at: string
        }
        Insert: {
          brand_code?: string
          completed_at?: string | null
          fetched_count?: number
          id?: string
          last_error?: string | null
          last_offset?: number
          last_sm_opportunity_id?: string | null
          move_category: string
          org_id: string
          started_at?: string | null
          status?: string
          target_count?: number
          updated_at?: string
        }
        Update: {
          brand_code?: string
          completed_at?: string | null
          fetched_count?: number
          id?: string
          last_error?: string | null
          last_offset?: number
          last_sm_opportunity_id?: string | null
          move_category?: string
          org_id?: string
          started_at?: string | null
          status?: string
          target_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sm_sync_cursor_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_logs: {
        Row: {
          brand: string | null
          call_id: string | null
          customer_id: string | null
          from_number: string | null
          id: string
          message: string | null
          org_id: string
          related_id: string | null
          related_type: string | null
          sent_at: string | null
          status: string | null
          template_key: string | null
          to_number: string | null
        }
        Insert: {
          brand?: string | null
          call_id?: string | null
          customer_id?: string | null
          from_number?: string | null
          id?: string
          message?: string | null
          org_id: string
          related_id?: string | null
          related_type?: string | null
          sent_at?: string | null
          status?: string | null
          template_key?: string | null
          to_number?: string | null
        }
        Update: {
          brand?: string | null
          call_id?: string | null
          customer_id?: string | null
          from_number?: string | null
          id?: string
          message?: string | null
          org_id?: string
          related_id?: string | null
          related_type?: string | null
          sent_at?: string | null
          status?: string | null
          template_key?: string | null
          to_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      stages: {
        Row: {
          id: string
          name: string
          pipeline_id: string
          position: number
        }
        Insert: {
          id?: string
          name: string
          pipeline_id: string
          position: number
        }
        Update: {
          id?: string
          name?: string
          pipeline_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_state: {
        Row: {
          cursor: string | null
          error: string | null
          id: string
          last_run_at: string | null
          org_id: string
          provider_key: string
          rows_synced: number | null
          status: string | null
          table_name: string
        }
        Insert: {
          cursor?: string | null
          error?: string | null
          id?: string
          last_run_at?: string | null
          org_id: string
          provider_key: string
          rows_synced?: number | null
          status?: string | null
          table_name: string
        }
        Update: {
          cursor?: string | null
          error?: string | null
          id?: string
          last_run_at?: string | null
          org_id?: string
          provider_key?: string
          rows_synced?: number | null
          status?: string | null
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_state_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      tariff_assignments: {
        Row: {
          branch_id: string | null
          id: string
          opportunity_type: string | null
          priority: number | null
          service_type: string | null
          tariff_id: string
        }
        Insert: {
          branch_id?: string | null
          id?: string
          opportunity_type?: string | null
          priority?: number | null
          service_type?: string | null
          tariff_id: string
        }
        Update: {
          branch_id?: string | null
          id?: string
          opportunity_type?: string | null
          priority?: number | null
          service_type?: string | null
          tariff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tariff_assignments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tariff_assignments_tariff_id_fkey"
            columns: ["tariff_id"]
            isOneToOne: false
            referencedRelation: "tariffs"
            referencedColumns: ["id"]
          },
        ]
      }
      tariff_handicaps: {
        Row: {
          condition_json: Json | null
          id: string
          multiplier: number | null
          name: string
          tariff_id: string
        }
        Insert: {
          condition_json?: Json | null
          id?: string
          multiplier?: number | null
          name: string
          tariff_id: string
        }
        Update: {
          condition_json?: Json | null
          id?: string
          multiplier?: number | null
          name?: string
          tariff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tariff_handicaps_tariff_id_fkey"
            columns: ["tariff_id"]
            isOneToOne: false
            referencedRelation: "tariffs"
            referencedColumns: ["id"]
          },
        ]
      }
      tariff_modifiers: {
        Row: {
          formula_json: Json | null
          id: string
          kind: string
          label: string | null
          stacking_order: number | null
          tariff_id: string
        }
        Insert: {
          formula_json?: Json | null
          id?: string
          kind: string
          label?: string | null
          stacking_order?: number | null
          tariff_id: string
        }
        Update: {
          formula_json?: Json | null
          id?: string
          kind?: string
          label?: string | null
          stacking_order?: number | null
          tariff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tariff_modifiers_tariff_id_fkey"
            columns: ["tariff_id"]
            isOneToOne: false
            referencedRelation: "tariffs"
            referencedColumns: ["id"]
          },
        ]
      }
      tariff_rates: {
        Row: {
          base_rate: number | null
          conditions_json: Json | null
          id: string
          kind: string
          label: string | null
          min_charge: number | null
          tariff_id: string
          unit: string | null
        }
        Insert: {
          base_rate?: number | null
          conditions_json?: Json | null
          id?: string
          kind: string
          label?: string | null
          min_charge?: number | null
          tariff_id: string
          unit?: string | null
        }
        Update: {
          base_rate?: number | null
          conditions_json?: Json | null
          id?: string
          kind?: string
          label?: string | null
          min_charge?: number | null
          tariff_id?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tariff_rates_tariff_id_fkey"
            columns: ["tariff_id"]
            isOneToOne: false
            referencedRelation: "tariffs"
            referencedColumns: ["id"]
          },
        ]
      }
      tariff_tiers: {
        Row: {
          id: string
          rate: number | null
          tariff_rate_id: string
          threshold: number | null
        }
        Insert: {
          id?: string
          rate?: number | null
          tariff_rate_id: string
          threshold?: number | null
        }
        Update: {
          id?: string
          rate?: number | null
          tariff_rate_id?: string
          threshold?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tariff_tiers_tariff_rate_id_fkey"
            columns: ["tariff_rate_id"]
            isOneToOne: false
            referencedRelation: "tariff_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      tariff_valuations: {
        Row: {
          coverage_type: string | null
          deductible: number | null
          id: string
          name: string
          rate_per_thousand: number | null
          tariff_id: string
        }
        Insert: {
          coverage_type?: string | null
          deductible?: number | null
          id?: string
          name: string
          rate_per_thousand?: number | null
          tariff_id: string
        }
        Update: {
          coverage_type?: string | null
          deductible?: number | null
          id?: string
          name?: string
          rate_per_thousand?: number | null
          tariff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tariff_valuations_tariff_id_fkey"
            columns: ["tariff_id"]
            isOneToOne: false
            referencedRelation: "tariffs"
            referencedColumns: ["id"]
          },
        ]
      }
      tariffs: {
        Row: {
          archived: boolean | null
          branch_id: string | null
          created_at: string | null
          currency: string | null
          effective_from: string | null
          effective_to: string | null
          id: string
          is_default: boolean | null
          name: string
          org_id: string
          rounding_rule: string | null
          service_type: string | null
        }
        Insert: {
          archived?: boolean | null
          branch_id?: string | null
          created_at?: string | null
          currency?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          org_id: string
          rounding_rule?: string | null
          service_type?: string | null
        }
        Update: {
          archived?: boolean | null
          branch_id?: string | null
          created_at?: string | null
          currency?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          org_id?: string
          rounding_rule?: string | null
          service_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tariffs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tariffs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          body: string | null
          created_at: string | null
          due_at: string | null
          id: string
          org_id: string
          priority: number | null
          related_id: string | null
          related_type: string | null
          status: string
          title: string
          type: string | null
        }
        Insert: {
          assigned_to?: string | null
          body?: string | null
          created_at?: string | null
          due_at?: string | null
          id?: string
          org_id: string
          priority?: number | null
          related_id?: string | null
          related_type?: string | null
          status?: string
          title: string
          type?: string | null
        }
        Update: {
          assigned_to?: string | null
          body?: string | null
          created_at?: string | null
          due_at?: string | null
          id?: string
          org_id?: string
          priority?: number | null
          related_id?: string | null
          related_type?: string | null
          status?: string
          title?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          body: string
          category: string | null
          channel: string
          created_at: string | null
          id: string
          key: string
          org_id: string
          subject: string | null
          variables: string[] | null
        }
        Insert: {
          body: string
          category?: string | null
          channel: string
          created_at?: string | null
          id?: string
          key: string
          org_id: string
          subject?: string | null
          variables?: string[] | null
        }
        Update: {
          body?: string
          category?: string | null
          channel?: string
          created_at?: string | null
          id?: string
          key?: string
          org_id?: string
          subject?: string | null
          variables?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assigned_to: string | null
          customer_id: string | null
          follow_up_at: string | null
          id: string
          job_id: string | null
          last_activity_at: string | null
          opened_at: string | null
          org_id: string
          priority: number | null
          status: string
          ticket_name: string
          type: string | null
        }
        Insert: {
          assigned_to?: string | null
          customer_id?: string | null
          follow_up_at?: string | null
          id?: string
          job_id?: string | null
          last_activity_at?: string | null
          opened_at?: string | null
          org_id: string
          priority?: number | null
          status?: string
          ticket_name: string
          type?: string | null
        }
        Update: {
          assigned_to?: string | null
          customer_id?: string | null
          follow_up_at?: string | null
          id?: string
          job_id?: string | null
          last_activity_at?: string | null
          opened_at?: string | null
          org_id?: string
          priority?: number | null
          status?: string
          ticket_name?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      trucks: {
        Row: {
          capacity: number | null
          id: string
          name: string
          org_id: string
        }
        Insert: {
          capacity?: number | null
          id?: string
          name: string
          org_id: string
        }
        Update: {
          capacity?: number | null
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trucks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      users_profiles: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          org_id: string
          role: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          display_name?: string | null
          org_id: string
          role?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          display_name?: string | null
          org_id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      valuation_patterns: {
        Row: {
          avg_declared_value_when_full: number | null
          brand_code: string
          id: string
          move_category: string
          org_id: string
          pct_basic: number | null
          pct_full: number | null
          refreshed_at: string
          sample_n: number
        }
        Insert: {
          avg_declared_value_when_full?: number | null
          brand_code?: string
          id?: string
          move_category: string
          org_id: string
          pct_basic?: number | null
          pct_full?: number | null
          refreshed_at?: string
          sample_n?: number
        }
        Update: {
          avg_declared_value_when_full?: number | null
          brand_code?: string
          id?: string
          move_category?: string
          org_id?: string
          pct_basic?: number | null
          pct_full?: number | null
          refreshed_at?: string
          sample_n?: number
        }
        Relationships: [
          {
            foreignKeyName: "valuation_patterns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_activity_by_external_id: {
        Args: {
          p_external_id: string
          p_kind: string
          p_object_key: string
          p_org_id: string
          p_payload: Json
        }
        Returns: string
      }
      current_org_ids: { Args: never; Returns: string[] }
      get_my_org_id: { Args: never; Returns: string }
      recompute_invoice_for_id: { Args: { inv_id: string }; Returns: undefined }
      refresh_estimator_stats:
        | { Args: { p_org_id: string }; Returns: undefined }
        | {
            Args: { p_brand_code?: string; p_org_id?: string }
            Returns: undefined
          }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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
  public: {
    Enums: {},
  },
} as const
