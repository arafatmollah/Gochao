import type { SpotlightEntry } from '@/types/entertainment';

/**
 * Offline Spotlight catalog: upcoming tentpoles and acclaimed essentials
 * shipped with the app. This is a curated highlights list, not a live
 * feed — studios move dates, so the UI labels upcoming years as expected.
 * Saving an entry copies it into the user's own watchlist.
 */
export const SPOTLIGHT_CATALOG: readonly SpotlightEntry[] = [
  // Upcoming tentpoles (expected years; dates shift).
  {
    id: 'spot-doomsday',
    title: 'Avengers: Doomsday',
    kind: 'movie',
    year: '2026',
    blurb: 'The MCU goes supermassive — same-day box-office clash with Dune.',
    section: 'upcoming',
  },
  {
    id: 'spot-dune-3',
    title: 'Dune: Part Three',
    kind: 'movie',
    year: '2026',
    blurb: 'Villeneuve closes out the trilogy on the same December weekend.',
    section: 'upcoming',
  },
  {
    id: 'spot-spidey-bnd',
    title: 'Spider-Man: Brand New Day',
    kind: 'movie',
    year: '2026',
    blurb: 'A fresh start for the MCU wall-crawler.',
    section: 'upcoming',
  },
  {
    id: 'spot-project-hail-mary',
    title: 'Project Hail Mary',
    kind: 'movie',
    year: '2026',
    blurb: 'Gosling in the adaptation of Weir’s lone-astronaut survival story.',
    section: 'upcoming',
  },
  {
    id: 'spot-supergirl',
    title: 'Supergirl',
    kind: 'movie',
    year: '2026',
    blurb: 'The DCU’s Maid of Might takes the lead.',
    section: 'upcoming',
  },
  {
    id: 'spot-hunger-sunrise',
    title: 'The Hunger Games: Sunrise on the Reaping',
    kind: 'movie',
    year: '2026',
    blurb: 'Return to Panem for Haymitch’s Games.',
    section: 'upcoming',
  },
  {
    id: 'spot-mando-grogu',
    title: 'The Mandalorian and Grogu',
    kind: 'movie',
    year: '2026',
    blurb: 'Star Wars back on the big screen.',
    section: 'upcoming',
  },
  {
    id: 'spot-batman-2',
    title: 'The Batman Part II',
    kind: 'movie',
    year: '2027',
    blurb: 'Reeves and Pattinson return to Gotham.',
    section: 'upcoming',
  },
  // Acclaimed essentials (most-recommended rewatchables).
  {
    id: 'spot-shawshank',
    title: 'The Shawshank Redemption',
    kind: 'movie',
    year: '1994',
    blurb: 'The perennial #1 on audience all-time lists.',
    section: 'acclaimed',
  },
  {
    id: 'spot-dark-knight',
    title: 'The Dark Knight',
    kind: 'movie',
    year: '2008',
    blurb: 'The superhero film by which the genre is judged.',
    section: 'acclaimed',
  },
  {
    id: 'spot-inception',
    title: 'Inception',
    kind: 'movie',
    year: '2010',
    blurb: 'Nolan’s dream-heist demands a second viewing.',
    section: 'acclaimed',
  },
  {
    id: 'spot-spirited',
    title: 'Spirited Away',
    kind: 'movie',
    year: '2001',
    blurb: 'Miyazaki’s masterpiece — start here for anime.',
    section: 'acclaimed',
  },
  {
    id: 'spot-3-idiots',
    title: '3 Idiots',
    kind: 'movie',
    year: '2009',
    blurb: 'The beloved campus classic for the whole family.',
    section: 'acclaimed',
  },
  {
    id: 'spot-godfather',
    title: 'The Godfather',
    kind: 'movie',
    year: '1972',
    blurb: 'Cinema’s definitive crime saga.',
    section: 'acclaimed',
  },
  {
    id: 'spot-parasite',
    title: 'Parasite',
    kind: 'movie',
    year: '2019',
    blurb: 'Bong Joon Ho’s Oscar-winning genre shapeshifter.',
    section: 'acclaimed',
  },
  {
    id: 'spot-dune-2',
    title: 'Dune: Part Two',
    kind: 'movie',
    year: '2024',
    blurb: 'Required viewing before Part Three arrives.',
    section: 'acclaimed',
  },
];

export const SPOTLIGHT_UPCOMING: readonly SpotlightEntry[] = SPOTLIGHT_CATALOG.filter(
  (entry) => entry.section === 'upcoming',
);

export const SPOTLIGHT_ACCLAIMED: readonly SpotlightEntry[] = SPOTLIGHT_CATALOG.filter(
  (entry) => entry.section === 'acclaimed',
);
