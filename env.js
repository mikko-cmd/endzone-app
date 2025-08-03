import { config } from 'dotenv';
import { expand } from 'dotenv-expand';

// Explicitly load the .env.local file
expand(config({ path: '.env.local' }));
