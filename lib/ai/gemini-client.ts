import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

const API_KEY = process.env.GOOGLE_GEMINI_API_KEY;

// Singleton instance
let modelInstance: GenerativeModel | null = null;

export const getGeminiModel = (jsonMode: boolean = true): GenerativeModel => {
  if (!API_KEY) {
    throw new Error('GOOGLE_GEMINI_API_KEY environment variable is not set');
  }

  // We create a new instance if configuration changes, but for now we default to JSON mode
  const genAI = new GoogleGenerativeAI(API_KEY);
  return genAI.getGenerativeModel({ 
    model: 'gemini-1.5-flash',
    generationConfig: {
      responseMimeType: jsonMode ? "application/json" : "text/plain"
    }
  });
};

export const generateJson = async <T>(prompt: string): Promise<T> => {
  try {
    const model = getGeminiModel(true);
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    try {
      return JSON.parse(text) as T;
    } catch (e) {
      console.error('Failed to parse JSON from Gemini response:', text);
      throw new Error('Invalid JSON response from Gemini');
    }
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw error;
  }
};
