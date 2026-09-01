export const ROAST_TEMPLATES = [
  'Your LinkedIn bio has more buzzwords than actual production commits.',
  'Built like a senior architect on Twitter, debugging like a week-one intern in real life.',
  'Your entire personality is a 5 AM morning routine video that got 3 likes.',
  'Calls themself a "Disruptor" but gets emotionally disrupted by a missing semicolon.',
  'Commit history looks like morse code for "Please send senior dev help".',
  'You brag about 80-hour work weeks just to hide the fact you don\'t know keyboard shortcuts.',
  'Bio says "Serial Entrepreneur", bank account says "Lives on free conference lanyards and ramen".',
  'If confidence was currency you\'d be a billionaire, but your pull requests are declared bankrupt.',
  'Your code is proof that copy-pasting from StackOverflow without reading comments is dangerous.',
  'You talk about AI agents like you personally trained the neural net in your dorm room.',
  'That profile picture has more filters than your company\'s air purification unit.',
  'Started 6 stealth startups, completed 0 README files.',
  'Your GitHub contributions graph is flatter than your sense of humor.',
  'Has "Thought Leader" in headline, has never had a unique thought in their entire career.',
  'Types with mechanical switches so loud you\'d think they were inventing fire, just writing a console.log.',
  'More active in LinkedIn comment sections than in their children\'s upbringing.',
  'Claimed "10x Developer", turns out it\'s 10x the Jira tickets and 10x the server costs.',
  'Your resume reads like a fantasy novel where you play the heroic savior of broken npm packages.',
  'Spends 4 hours configuring Neovim to save 2 seconds writing boilerplate JavaScript.',
  'Only thing getting scaled in your startup is the CEO\'s delusion level.',
  'Uses dark mode because their future as a senior engineer is looking pretty dim.',
  'One merge conflict away from quitting tech to sell artisanal sourdough bread.'
];

export function getRandomRoastTemplate(targetUsername) {
  const index = Math.floor(Math.random() * ROAST_TEMPLATES.length);
  const template = ROAST_TEMPLATES[index];
  if (targetUsername) {
    return `@${targetUsername.replace(/^@/, '')} - ${template}`;
  }
  return template;
}
