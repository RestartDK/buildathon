import { OpenAI } from 'openai';
import { z } from 'zod';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Request/response schemas
const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
});

const ChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema),
  stepCount: z.number().int().min(0).optional(),
  goal: z.number().int().min(1).optional(),
  avatarState: z.enum(['fat', 'normal', 'fit']).optional(),
});

type ChatMessage = z.infer<typeof ChatMessageSchema>;

// Generate system prompt with user's current progress
const generateSystemPrompt = (stepCount?: number, goal?: number, avatarState?: string): string => {
  let prompt = `You are a helpful assistant for a fitness tracking app. 
The app tracks steps and has an avatar that changes based on progress (fat -> normal -> fit).
Users can ask you questions about their fitness progress, goals, or general health advice.
Be encouraging and supportive.`;

  if (stepCount !== undefined && goal !== undefined) {
    const progress = Math.round((stepCount / goal) * 100);
    const remaining = Math.max(0, goal - stepCount);
    
    prompt += `\n\nCurrent user progress:
- Steps taken: ${stepCount.toLocaleString()}
- Daily goal: ${goal.toLocaleString()} steps
- Progress: ${progress}%
- Steps remaining: ${remaining.toLocaleString()}`;

    if (avatarState) {
      prompt += `\n- Avatar state: ${avatarState}`;
    }

    if (stepCount < goal) {
      prompt += `\n\nThe user is ${remaining.toLocaleString()} steps away from their daily goal. Provide encouraging suggestions to help them reach it.`;
    } else if (stepCount < goal * 2) {
      prompt += `\n\nThe user has reached their daily goal! Encourage them to keep going for extra benefits.`;
    } else {
      prompt += `\n\nThe user has exceeded their daily goal significantly! Celebrate their achievement.`;
    }
  }

  return prompt;
};

// Create HTTP server using Bun
const server = Bun.serve({
  port: 3001,
  async fetch(req) {
    // Handle CORS
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Handle chat endpoint
    if (req.url.endsWith('/chat')) {
      try {
        const body = await req.json();
        
        // Validate request
        const validatedData = ChatRequestSchema.parse(body);
        
        // Generate system prompt with user's current progress
        const systemPrompt = generateSystemPrompt(
          validatedData.stepCount,
          validatedData.goal,
          validatedData.avatarState
        );
        
        // Prepare messages with system prompt
        const messages: ChatMessage[] = [
          { role: 'system', content: systemPrompt },
          ...validatedData.messages,
        ];

        // Call OpenAI API
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
          temperature: 0.7,
        });

        const assistantMessage = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

        return new Response(
          JSON.stringify({
            message: assistantMessage,
            role: 'assistant',
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      } catch (error) {
        console.error('Chat error:', error);
        
        if (error instanceof z.ZodError) {
          return new Response(
            JSON.stringify({ error: 'Invalid request format', details: error.errors }),
            {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              },
            }
          );
        }

        return new Response(
          JSON.stringify({ 
            error: 'Failed to process chat request',
            message: error instanceof Error ? error.message : 'Unknown error'
          }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }
    }

    // Health check endpoint
    if (req.url.endsWith('/health')) {
      return new Response(
        JSON.stringify({ status: 'ok' }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  },
});

console.log(`🚀 Chat server running on http://localhost:${server.port}`);
console.log(`📡 Endpoints:`);
console.log(`   POST /chat - Chat with OpenAI`);
console.log(`   GET  /health - Health check`);
