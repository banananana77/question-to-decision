import { z } from 'zod';
import { DEMO_LIMITS } from '@/config/limits';

export const inputSchema = z.object({
  text: z
    .string()
    .min(10, '入力は10文字以上必要です')
    .max(DEMO_LIMITS.MAX_INPUT_LENGTH, `入力は${DEMO_LIMITS.MAX_INPUT_LENGTH}文字以内にしてください`),

  fingerprint: z.string().optional(), // クライアント側で生成
});

export type InputData = z.infer<typeof inputSchema>;
