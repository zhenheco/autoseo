export const models = {
  FREE: {
    'google/gemini-2.0-flash-exp:free': {
      name: 'Gemini 2.0 Flash (Free)',
      rpm: 15,
      tpm: 1000000,
      dailyLimit: 1500000
    },
    'deepseek/deepseek-chat-v3.1:free': {
      name: 'DeepSeek Chat V3.1 (Free)',
      rpm: 50,
      tpm: 1000000,
      dailyLimit: 10000000
    },
    'meta-llama/llama-4-maverick:free': {
      name: 'Llama 4 Maverick (Free)',
      rpm: 30,
      tpm: 500000,
      dailyLimit: 5000000
    }
  },
  PAID: {
    'google/gemini-2.5-pro': {
      name: 'Gemini 2.5 Pro',
      inputPrice: 0.00125,
      outputPrice: 0.005
    },
    'openai/gpt-5-turbo': {
      name: 'GPT-5 Turbo',
      inputPrice: 0.00125,
      outputPrice: 0.01
    }
  }
};