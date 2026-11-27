import { CategoryConfig, JournalEntry, MoodOption } from '../types/journal';

export const MOOD_OPTIONS: MoodOption[] = [
  { id: 'productive', emoji: '🔥', label: 'Productive' },
  { id: 'good', emoji: '😊', label: 'Good' },
  { id: 'overwhelmed', emoji: '😵‍💫', label: 'Overwhelmed' },
  { id: 'lazy', emoji: '😴', label: 'Lazy' },
];

export const COLOR_SWATCHES: { name: string; hex: string }[] = [
  { name: 'Matcha', hex: '#3D6B52' },
  { name: 'Sky', hex: '#3B6E9C' },
  { name: 'Lavender', hex: '#6E5AA8' },
  { name: 'Rose', hex: '#B4536E' },
  { name: 'Honey', hex: '#B47B2B' },
  { name: 'Teal', hex: '#2E7D7B' },
  { name: 'Clay', hex: '#9E5A46' },
  { name: 'Slate', hex: '#5A6370' },
  { name: 'Olive', hex: '#6B7A3B' },
  { name: 'Plum', hex: '#884B78' },
];

export const DEFAULT_CATEGORIES: CategoryConfig[] = [
  { id: 'cat-shadowing', name: 'English Shadowing', color: '#3D6B52' },
  { id: 'cat-grammar', name: 'Grammar', color: '#3B6E9C' },
  { id: 'cat-vocab', name: 'Vocabulary', color: '#6E5AA8' },
  { id: 'cat-speaking', name: 'Speaking', color: '#B4536E' },
  { id: 'cat-drama', name: 'Drama / Chill', color: '#B47B2B' },
  { id: 'cat-other', name: 'Other', color: '#5A6370' },
];

function getRelativeDateIso(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createSampleEntries(): JournalEntry[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'sample-1',
      date: getRelativeDateIso(0),
      title: 'Morning Shadowing — Casual Daily Vlog & Connected Speech',
      categoryIds: ['cat-shadowing', 'cat-speaking'],
      links: [
        {
          id: 'link-1',
          label: 'YouTube Reach Video — Natural English Cadence',
          url: 'https://www.youtube.com/results?search_query=english+shadowing+practice+daily+vlog',
        },
        {
          id: 'link-2',
          label: 'YouGlish Pronunciation Check',
          url: 'https://youglish.com',
        },
      ],
      images: [],
      checklist: [
        { id: 'chk-1', text: 'Shadow 10 mins at 0.9x speed', done: true },
        { id: 'chk-2', text: 'Shadow 10 mins at 1.0x natural speed', done: true },
        { id: 'chk-3', text: 'Record 2-min voice memo & listen back', done: false },
      ],
      takeaways:
        '- Practiced linking consonant-to-vowel sounds like `kind of` -> "kinda" and `want to` -> "wanna" at 0.9x then 1.0x speed.\n- **Key phrase:** ==It totally slipped my mind== — sounds much more natural than "I completely forgot about it."\n- Recording myself for 2 minutes showed I rush the end of long sentences; slowing down helps clarity.',
      mood: 'productive',
      isHighlighted: true,
      durationMinutes: 30,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'sample-2',
      date: getRelativeDateIso(0),
      title: 'Quick 15-min Mixed Conditionals Review',
      categoryIds: ['cat-grammar'],
      links: [
        {
          id: 'link-3',
          label: 'AIO English Exercise — Mixed Conditionals',
          url: 'https://www.perfect-english-grammar.com/conditionals.html',
        },
      ],
      images: [],
      checklist: [
        { id: 'chk-4', text: 'Finish 15 timed grammar drill questions', done: true },
        { id: 'chk-5', text: 'Write 2 personal sentences using Had I known...', done: false },
      ],
      takeaways:
        '- **Past condition -> Present result:** ==If + had + V3, would + V1== (e.g., "If I had slept earlier, I wouldn\'t feel so drained right now.")\n- Scored 13/15 on the timed drill; tripped up twice on omitting "if" with inversion (`Had I known...`).',
      mood: 'good',
      isHighlighted: false,
      durationMinutes: 15,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'sample-3',
      date: getRelativeDateIso(1),
      title: 'Phrasal Verbs & Work-Life Idioms Notebook',
      categoryIds: ['cat-vocab'],
      links: [
        {
          id: 'link-4',
          label: 'Cambridge Dictionary — Phrasal Verbs List',
          url: 'https://dictionary.cambridge.org',
        },
        {
          id: 'link-5',
          label: 'Anki Flashcard Deck Notes',
          url: 'https://apps.ankiweb.net',
        },
      ],
      images: [],
      checklist: [
        { id: 'chk-6', text: 'Add 12 context sentences to Anki deck', done: true },
        { id: 'chk-7', text: 'Review yesterday’s phrasal verb cards', done: true },
      ],
      takeaways:
        '- `wind down`: ==gradually relax after a busy day== ("I usually wind down with herbal tea and a podcast.")\n- `pan out`: turn out well or succeed ("Let\'s see how the new study schedule pans out.")\n- `burn the midnight oil`: stay up late studying or working.\n- Added 12 new context sentences instead of isolated word translations.',
      mood: 'productive',
      isHighlighted: true,
      durationMinutes: 45,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'sample-4',
      date: getRelativeDateIso(2),
      title: 'Watched 1 Episode Without Native Subtitles (Cozy Sitcom)',
      categoryIds: ['cat-drama', 'cat-vocab'],
      links: [
        {
          id: 'link-6',
          label: 'Episode Transcript Reference',
          url: 'https://subslikescript.com',
        },
      ],
      images: [],
      checklist: [],
      takeaways:
        '- Kept only English subtitles on for the first 20 minutes — understood ~85% without pausing!\n- **Fun casual expressions:** `no biggie`, `hang tight`, and `call it a day`.\n- Low-energy evening, so switching to chill immersion kept the habit alive without burning out.',
      mood: 'lazy',
      isHighlighted: false,
      durationMinutes: 25,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'sample-5',
      date: getRelativeDateIso(3),
      title: '5-Minute Solo Speaking Prompt: Weekend Plans',
      categoryIds: ['cat-speaking'],
      links: [
        {
          id: 'link-7',
          label: 'IELTS & Daily Speaking Prompts',
          url: 'https://ieltsliz.com/ielts-speaking-free-lessons-essential-tips/',
        },
      ],
      images: [],
      checklist: [],
      takeaways:
        '- Felt a bit stuck halfway through explaining my routine, so I practiced filler transitions like `To be honest`, `Come to think of it`, and `On top of that`.\n- **Note to self:** ==Stop self-correcting mid-sentence==; finish the thought first, then review.',
      mood: 'overwhelmed',
      isHighlighted: false,
      durationMinutes: 20,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'sample-6',
      date: getRelativeDateIso(5),
      title: 'Weekend Deep Dive — Articles (a / an / the) Nuances',
      categoryIds: ['cat-grammar', 'cat-other'],
      links: [
        {
          id: 'link-8',
          label: 'BBC Learning English — Grammar Reference',
          url: 'https://www.bbc.co.uk/learningenglish',
        },
      ],
      images: [],
      checklist: [],
      takeaways:
        '- Zero article for general plural/uncountable concepts (`Music helps me focus` vs `The music in this cafe is cozy`).\n- Created a mini cheat-sheet for geographical names and institutions (`go to bed`, `at school`, `in the hospital`).',
      mood: 'good',
      isHighlighted: false,
      durationMinutes: 40,
      createdAt: now,
      updatedAt: now,
    },
  ];
}
