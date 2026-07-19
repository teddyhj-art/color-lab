import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://oacaltpmwnhgrbsqeoac.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hY2FsdHBtd25oZ3Jic3Flb2FjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NDA3NjMsImV4cCI6MjA5OTQxNjc2M30.Pw9YQ2AduuEHI46_ew4kBQiFZLlK5GmeFRcz481NJL4'
)