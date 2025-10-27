import { callOpenRouter } from '../openrouter';

export { callOpenRouter };

// 為了向後兼容
export const createOpenRouter = () => {
  console.warn('createOpenRouter is deprecated, use callOpenRouter directly');
  return {
    chat: {
      completions: {
        create: async (params: any) => callOpenRouter(params)
      }
    }
  };
};