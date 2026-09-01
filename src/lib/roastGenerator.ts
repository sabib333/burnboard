export interface RoastTemplate {
  id: string;
  template: string;
  category: 'career' | 'ego' | 'code' | 'lifestyle' | 'social';
}

export const ROAST_TEMPLATES: RoastTemplate[] = [
  {
    id: 't1',
    template: 'Your LinkedIn bio has more buzzwords than actual production commits.',
    category: 'career'
  },
  {
    id: 't2',
    template: 'Built like a senior architect on Twitter, debugging like a week-one intern in real life.',
    category: 'code'
  },
  {
    id: 't3',
    template: 'Your entire personality is a 5 AM morning routine video that got 3 likes.',
    category: 'lifestyle'
  },
  {
    id: 't4',
    template: 'Calls themself a "Disruptor" but gets emotionally disrupted by a missing semicolon.',
    category: 'ego'
  },
  {
    id: 't5',
    template: 'Commit history looks like morse code for "Please send senior dev help".',
    category: 'code'
  },
  {
    id: 't6',
    template: 'You brag about 80-hour work weeks just to hide the fact you don\'t know keyboard shortcuts.',
    category: 'career'
  },
  {
    id: 't7',
    template: 'Bio says "Serial Entrepreneur", bank account says "Lives on free conference lanyards and ramen".',
    category: 'career'
  },
  {
    id: 't8',
    template: 'If confidence was currency you\'d be a billionaire, but your pull requests are declared bankrupt.',
    category: 'ego'
  },
  {
    id: 't9',
    template: 'Your code is proof that copy-pasting from StackOverflow without reading comments is dangerous.',
    category: 'code'
  },
  {
    id: 't10',
    template: 'You talk about AI agents like you personally trained the neural net in your dorm room.',
    category: 'ego'
  },
  {
    id: 't11',
    template: 'That profile picture has more filters than your company\'s air purification unit.',
    category: 'social'
  },
  {
    id: 't12',
    template: 'Started 6 stealth startups, completed 0 README files.',
    category: 'career'
  },
  {
    id: 't13',
    template: 'Your GitHub contributions graph is flatter than your sense of humor.',
    category: 'code'
  },
  {
    id: 't14',
    template: 'Has "Thought Leader" in headline, has never had a unique thought in their entire career.',
    category: 'career'
  },
  {
    id: 't15',
    template: 'Types with mechanical switches so loud you\'d think they were inventing fire, just writing a console.log.',
    category: 'lifestyle'
  },
  {
    id: 't16',
    template: 'More active in LinkedIn comment sections than in their children\'s upbringing.',
    category: 'social'
  },
  {
    id: 't17',
    template: 'Claimed "10x Developer", turns out it\'s 10x the Jira tickets and 10x the server costs.',
    category: 'code'
  },
  {
    id: 't18',
    template: 'Your resume reads like a fantasy novel where you play the heroic savior of broken npm packages.',
    category: 'career'
  },
  {
    id: 't19',
    template: 'Spends 4 hours configuring Neovim to save 2 seconds writing boilerplate JavaScript.',
    category: 'lifestyle'
  },
  {
    id: 't20',
    template: 'Only thing getting scaled in your startup is the CEO\'s delusion level.',
    category: 'ego'
  },
  {
    id: 't21',
    template: 'Uses dark mode because their future as a senior engineer is looking pretty dim.',
    category: 'code'
  },
  {
    id: 't22',
    template: 'One merge conflict away from quitting tech to sell artisanal sourdough bread.',
    category: 'lifestyle'
  }
];

export function getRandomRoastTemplate(targetUsername?: string): string {
  const index = Math.floor(Math.random() * ROAST_TEMPLATES.length);
  const template = ROAST_TEMPLATES[index].template;
  if (targetUsername) {
    return `@${targetUsername.replace(/^@/, '')} - ${template}`;
  }
  return template;
}
