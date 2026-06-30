import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://kynwcaoauwreyfavfhkw.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5bndjYW9hdXdyZXlmYXZmaGt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NDIyODgsImV4cCI6MjA5ODQxODI4OH0.zQY2X_cmdQIXz8AzkjsFO3f7InVc75c_IpFztgwRnGo'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)