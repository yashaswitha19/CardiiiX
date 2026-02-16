import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fuhawgevwdjjnrwclvgg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1aGF3Z2V2d2Rqam5yd2NsdmdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3OTQzNzMsImV4cCI6MjA4NTM3MDM3M30.u6Aul286DY3Y4WLrdF7C5CokH00D3rHNnxUxNGnxXrk';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});


export default supabase;
