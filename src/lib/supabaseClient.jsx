
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cbwvckjkdiyeasuxwzna.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNid3Zja2prZGl5ZWFzdXh3em5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MjIwMTIsImV4cCI6MjA5MTk5ODAxMn0.oGFClWXet5eAXYfvXdT5ri-M56P6O3pCp1BBr2uUM4I';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
