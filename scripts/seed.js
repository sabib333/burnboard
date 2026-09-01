#!/usr/bin/env node

/**
 * BURNBOARD Seed Script
 * Creates 20 fake profiles + 100 fake roasts for demo
 * Run with: node scripts/seed.js
 */

const PLATFORMS = ['LinkedIn', 'GitHub', 'X', 'Instagram', 'Indie Hacker', 'TikTok', 'Reddit'];

const USERNAMES = [
  'CryptoKingpin_99', 'AgileScrumLord', 'Vim_Virgin_42', 'FitnessGrindset',
  'AIWrapperCEO', 'SaaSBro_XL', 'CryptoOracle_BTC', 'DataDrivenDave',
  'ThoughtLeader_420', 'GrowthHacker_Pro', 'DevOpsNinja_99', 'UXWizard_Spotify',
  'FullStackKing', 'ProductHunt_Fan', 'SerialFounder_01', 'CloudArchitect_AWS',
  'ReactFanboy', 'PythonSnob', 'NodeJS_Titan', 'RustEvangelist'
];

const BIOS = [
  'Ex-BigTech | 4x Founder | Building AI to replace AI | Thoughts? Agree?',
  'I rewrite everything in Rust before it even works. 2.4k GitHub stars, 0 users.',
  'Calling 100x gems since 2021. Deleted 400 wrong tweets yesterday. WAGMI into debt.',
  'Wake up at 3:30 AM. Cold plunge. Write gratitude journal with fountain pen.',
  'Running a $50k/mo AI agency from Bali. 100% outsourced to interns.',
  'Shipping AI wrapper micro-SaaS products. $4.20 MRR. Ramen profitable.',
  'Certified SAFe Scrum Master. We need a 45-minute sync to plan the retro.',
  'Discipline equals freedom. 5 AM club. No excuses. DM for coaching.',
  'Building in public about building in public. Open source everything.',
  'I have 47 Twitter threads about productivity but zero shipped products.',
  'Full-stack developer who only builds landing pages for other developers.',
  'Startup founder who pivots every 3 days. Currently building a meme coin.',
  'Data scientist who makes dashboards nobody looks at.',
  'Product designer who changed the button color 47 times today.',
  'DevOps engineer who broke prod on a Friday and blamed the intern.',
  'UX researcher who watches people click buttons for a living.',
  'DevRel who gives talks at conferences nobody attends.',
  'Tech blogger who writes 5000-word essays about Hello World.',
  'Open source maintainer who yells at people for not reading the docs.',
  'Indie hacker who launched 12 products this month. None have users.'
];

const ROASTS = [
  'Your LinkedIn bio has more buzzwords than actual production commits.',
  'Built like a senior architect on Twitter, debugging like a week-one intern.',
  'Your entire personality is a 5 AM morning routine video that got 3 likes.',
  'Calls themself a Disruptor but gets disrupted by a missing semicolon.',
  'Commit history looks like morse code for "Please send senior dev help".',
  'You brag about 80-hour work weeks just to hide you don\'t know keyboard shortcuts.',
  'Bio says Serial Entrepreneur, bank account says Lives on free conference lanyards.',
  'If confidence was currency you\'d be a billionaire, but your PRs are bankrupt.',
  'Your code is proof that copy-pasting from StackOverflow is dangerous.',
  'You talk about AI agents like you personally trained the neural net.',
  'That profile picture has more filters than your company\'s air purifier.',
  'Started 6 stealth startups, completed 0 README files.',
  'Your GitHub contributions graph is flatter than your sense of humor.',
  'Has Thought Leader in headline, never had a unique thought in their career.',
  'Types with mechanical switches so loud you\'d think they were inventing fire.',
  'More active in LinkedIn comments than in their children\'s upbringing.',
  'Claimed 10x Developer, turns out it\'s 10x the Jira tickets.',
  'Your resume reads like a fantasy novel about npm package rescue.',
  'Spends 4 hours configuring Neovim to save 2 seconds writing boilerplate.',
  'Only thing getting scaled in your startup is the CEO\'s delusion level.',
  'Uses dark mode because their future as a senior engineer looks dim.',
  'One merge conflict away from quitting tech to sell sourdough bread.',
  'Refactored the entire codebase into 42 microservices for 3 daily users.',
  'Your whole business model is literally an iframe pointing to ChatGPT.',
  'You bought a high-end mic just to breathe aggressively into Slack huddles.',
  'Bro uses Arch Linux and will tell you within 0.4 seconds of entering a room.',
  'Calling your Google Sheets wrapper an enterprise AI copilot is warfare.',
  'You have more Twitter threads about MRR than lines of backend code.',
  'Claims to love mindful slow mornings while checking analytics 87 times.',
  'Your entire personality is beige linen pants and avocado toast photos.'
];

const ANON_NAMES = [
  'Anonymous #108', 'Anonymous #214', 'Anonymous #337', 'Anonymous #390',
  'Anonymous #443', 'Anonymous #482', 'Anonymous #551', 'Anonymous #602',
  'Anonymous #618', 'Anonymous #731', 'Anonymous #884', 'Anonymous #919',
  'Anonymous #129', 'Anonymous #256', 'Anonymous #314', 'Anonymous #420'
];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateProfiles(count) {
  const profiles = [];
  for (let i = 0; i < count; i++) {
    const username = USERNAMES[i % USERNAMES.length];
    const platform = PLATFORMS[i % PLATFORMS.length];
    const bio = BIOS[i % BIOS.length];
    const colors = [
      'bg-gradient-to-tr from-[#ff4d00] to-orange-400 text-black',
      'bg-gradient-to-tr from-blue-600 to-sky-400 text-white',
      'bg-gradient-to-tr from-emerald-500 to-teal-400 text-black',
      'bg-gradient-to-tr from-purple-500 to-pink-500 text-white',
      'bg-gradient-to-tr from-yellow-500 to-amber-400 text-black',
      'bg-gradient-to-tr from-rose-500 to-red-500 text-white'
    ];

    profiles.push({
      id: `prof-seed-${Date.now()}-${i}`,
      username,
      platform,
      bio,
      avatar_letter: username.charAt(0).toUpperCase(),
      avatar_color: colors[i % colors.length],
      tagline: `${platform} Roastee`,
      roast_count: Math.floor(Math.random() * 50) + 5,
      total_upvotes: Math.floor(Math.random() * 5000) + 100,
      created_at: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString()
    });
  }
  return profiles;
}

function generateRoasts(profiles, count) {
  const roasts = [];
  for (let i = 0; i < count; i++) {
    const profile = randomItem(profiles);
    roasts.push({
      id: `roast-seed-${Date.now()}-${i}`,
      profile_id: profile.id,
      roast_text: randomItem(ROASTS),
      upvotes: Math.floor(Math.random() * 500) + 10,
      reaction_haha: Math.floor(Math.random() * 200) + 5,
      reaction_brutal: Math.floor(Math.random() * 300) + 10,
      reaction_cry: Math.floor(Math.random() * 50) + 1,
      anon_id: randomItem(ANON_NAMES),
      created_at: new Date(Date.now() - Math.random() * 24 * 3600000).toISOString()
    });
  }
  return roasts;
}

function main() {
  console.log('🔥 BURNBOARD Seed Script');
  console.log('========================\n');

  const profiles = generateProfiles(20);
  const roasts = generateRoasts(profiles, 100);

  console.log(`✅ Generated ${profiles.length} profiles`);
  console.log(`✅ Generated ${roasts.length} roasts`);
  console.log(`📊 Total burns across all profiles: ${profiles.reduce((s, p) => s + p.roast_count, 0)}`);

  const output = {
    profiles,
    roasts,
    seed_date: new Date().toISOString(),
    note: 'Generated by BURNBOARD seed script — for demo purposes only'
  };

  const fs = await import('fs');
  fs.writeFileSync('seed-data.json', JSON.stringify(output, null, 2));
  console.log('\n📁 Saved to seed-data.json');
  console.log('🚀 Import this into Supabase or load into localStorage for demo.');
}

main().catch(console.error);
