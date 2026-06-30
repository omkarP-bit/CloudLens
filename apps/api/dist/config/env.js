import { z } from 'zod';
import dotenv from 'dotenv';
dotenv.config();
const envSchema = z.object({
    SUPABASE_URL: z.string().url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    SUPABASE_ANON_KEY: z.string().min(1),
    KMS_REGION: z.string().default('us-east-1'),
    KMS_CMK_ARN: z.string().min(1),
    PORT: z.string().transform((val) => parseInt(val, 10)).default('8000'),
    REDIS_URL: z.string().optional(),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    console.error('❌ Environment validation failed:', JSON.stringify(parsed.error.format(), null, 2));
    process.exit(1);
}
export const env = parsed.data;
