
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pzmapmxjkkqhuiamdvjd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6bWFwbXhqa2txaHVpYW1kdmpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNzUzMzMsImV4cCI6MjA2MjY1MTMzM30.YNcm5sm0GtvbCcT3ooyW2wNYcoOUUfLZJIhGrJPweQw';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
