export interface IslamicPrompt {
  id: string;
  category: 'faith' | 'family' | 'lifestyle' | 'values';
  prompt: string;
  placeholder: string;
}

export const ISLAMIC_PROMPTS: IslamicPrompt[] = [
  // Faith & Spirituality
  {
    id: 'favorite_surah',
    category: 'faith',
    prompt: 'My favorite Surah is...',
    placeholder: 'e.g., Surah Al-Rahman because it reminds me of Allah\'s mercy',
  },
  {
    id: 'islamic_value',
    category: 'faith',
    prompt: 'The Islamic value I live by...',
    placeholder: 'e.g., Sabr (patience) - it guides me through difficult times',
  },
  {
    id: 'prayer_meaning',
    category: 'faith',
    prompt: 'What prayer means to me...',
    placeholder: 'e.g., It\'s my daily reset and connection with Allah',
  },
  {
    id: 'ramadan_memories',
    category: 'faith',
    prompt: 'My favorite Ramadan memory...',
    placeholder: 'e.g., Breaking fast with my grandparents at sunset',
  },
  
  // Family & Traditions
  {
    id: 'eid_celebration',
    category: 'family',
    prompt: 'My ideal Eid celebration looks like...',
    placeholder: 'e.g., Morning prayer, family brunch, and visiting loved ones',
  },
  {
    id: 'family_tradition',
    category: 'family',
    prompt: 'A family tradition I love...',
    placeholder: 'e.g., Friday dinners together after Jummah prayer',
  },
  {
    id: 'future_family',
    category: 'family',
    prompt: 'In our future home, I hope we...',
    placeholder: 'e.g., Create a warm space filled with faith and laughter',
  },
  
  // Lifestyle & Interests
  {
    id: 'perfect_weekend',
    category: 'lifestyle',
    prompt: 'My perfect halal weekend includes...',
    placeholder: 'e.g., Fajr prayer, hiking, good food, and quality time',
  },
  {
    id: 'travel_dreams',
    category: 'lifestyle',
    prompt: 'A place I dream of visiting...',
    placeholder: 'e.g., Makkah and Madinah with my future spouse',
  },
  {
    id: 'hobbies_passion',
    category: 'lifestyle',
    prompt: 'I\'m passionate about...',
    placeholder: 'e.g., Reading Islamic history and cooking for others',
  },
  
  // Values & Intentions
  {
    id: 'looking_for',
    category: 'values',
    prompt: 'I\'m looking for someone who...',
    placeholder: 'e.g., Values deen, has a good sense of humor, and loves family',
  },
  {
    id: 'relationship_priority',
    category: 'values',
    prompt: 'In a relationship, I prioritize...',
    placeholder: 'e.g., Open communication, mutual respect, and growing together',
  },
  {
    id: 'gratitude',
    category: 'values',
    prompt: 'One thing I\'m grateful for...',
    placeholder: 'e.g., My faith, my family, and the opportunity to find love',
  },
  {
    id: 'first_date',
    category: 'values',
    prompt: 'A halal first date I\'d enjoy...',
    placeholder: 'e.g., Coffee and a nice walk in the park, with good conversation',
  },
];

export const getPromptById = (id: string): IslamicPrompt | undefined => {
  return ISLAMIC_PROMPTS.find(p => p.id === id);
};

export const getPromptsByCategory = (category: IslamicPrompt['category']): IslamicPrompt[] => {
  return ISLAMIC_PROMPTS.filter(p => p.category === category);
};

export interface ProfilePromptAnswer {
  promptId: string;
  answer: string;
}
