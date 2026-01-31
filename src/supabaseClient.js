// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js'

// Use Vite environment variables for security
// These are defined in your .env file at the project root
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)