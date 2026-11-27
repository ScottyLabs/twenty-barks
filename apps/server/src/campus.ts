/**
 * What Bark knows about Carnegie Mellon beyond the day's facts: places, nicknames, abbreviations, and traditions that players ask about, so "is it on the Mall?" or "is it related to CFA?" has something to go on.
 *
 * Only notes whose terms appear in the question or the secret go to Jev, which keeps requests small. A wrong note makes Bark confidently wrong, so only add what you are sure of, and say where a place is relative to other landmarks rather than in compass directions you have not checked.
 */
export interface CampusNote {
  /** Lowercase words or phrases that bring this note in. */
  readonly terms: readonly string[];
  readonly note: string;
}

export const CAMPUS: readonly CampusNote[] = [
  {
    terms: ["cmu", "carnegie mellon", "carnegie tech", "andrew carnegie", "campus"],
    note: 'Carnegie Mellon University (CMU) is in the Oakland neighborhood of Pittsburgh, next to the University of Pittsburgh and Schenley Park. Andrew Carnegie founded it in 1900 as the Carnegie Technical Schools, later Carnegie Tech; it merged with the Mellon Institute in 1967. Carnegie\'s motto for it is "My heart is in the work".',
  },
  {
    terms: ["mall", "the mall"],
    note: "The Mall: the long lawn through the middle of the main academic buildings, lined by Baker Hall and Porter Hall on one side and Doherty Hall on the other, with the College of Fine Arts building at one end and Hamerschlag Hall at the other. It is a different lawn from the Cut. It is not a shopping mall.",
  },
  {
    terms: ["cut", "the cut"],
    note: "The Cut: the big open lawn in the middle of campus beside the Cohon University Center, where the Fence stands. It is a different lawn from the Mall.",
  },
  {
    terms: ["uc", "cuc", "cohon", "university center", "student center", "rangos", "entropy"],
    note: "The Cohon University Center (the UC or CUC): the student center, beside the Cut and on Forbes Avenue. It has dining, a gym and swimming pool, the campus store, the Entropy convenience store, and event rooms such as Rangos Ballroom.",
  },
  {
    terms: [
      "cfa",
      "fine arts",
      "college of fine arts",
      "architecture",
      "drama",
      "music",
      "art",
      "design",
    ],
    note: "CFA: the College of Fine Arts, CMU's college of architecture, art, design, drama, and music. CFA is also the name of its building, at one end of the Mall.",
  },
  {
    terms: ["purnell", "drama", "theater", "theatre"],
    note: "The Purnell Center for the Arts: home of the School of Drama and its theaters, next to the Cohon University Center.",
  },
  {
    terms: ["gates", "ghc", "hillman", "pausch", "newell", "nsh", "computer science", "scs"],
    note: "The Gates and Hillman Centers (GHC): the main building of the School of Computer Science (SCS), joined to Newell-Simon Hall. The Randy Pausch Memorial Footbridge connects it to the area by the Purnell Center.",
  },
  {
    terms: ["wean"],
    note: "Wean Hall: a large concrete academic building used by computer science, mathematics, and physics, next to Doherty Hall.",
  },
  {
    terms: ["doherty", "dh"],
    note: "Doherty Hall: an academic building on the Mall used by science and engineering, with some of the biggest lecture halls on campus.",
  },
  {
    terms: ["baker", "porter", "bh", "ph"],
    note: "Baker Hall and Porter Hall: two joined academic buildings along the Mall, known for Baker Hall's very long hallway. They hold many Dietrich College and engineering departments.",
  },
  {
    terms: ["hamerschlag", "hh"],
    note: "Hamerschlag Hall: an engineering building with a round tower, at the end of the Mall opposite the College of Fine Arts.",
  },
  {
    terms: ["hunt", "library", "libraries", "sorrells"],
    note: "Hunt Library: CMU's main library. It also houses the Hunt Institute for Botanical Documentation. CMU's other libraries include the Sorrells Engineering and Science Library in Wean Hall.",
  },
  {
    terms: ["tepper", "business"],
    note: "The Tepper School of Business, CMU's business school, in the Tepper Quad building on Forbes Avenue.",
  },
  {
    terms: ["mellon institute", "mi"],
    note: "Mellon Institute: a large building with tall stone columns on Fifth Avenue, a short walk from the main campus, used for science labs.",
  },
  {
    terms: ["schenley", "schenley park", "flagstaff", "schenley drive"],
    note: "Schenley Park: the large city park beside campus. The buggy races run on its Schenley Drive, and Flagstaff Hill is in it.",
  },
  {
    terms: ["forbes", "fifth", "oakland", "pitt", "craig"],
    note: "Forbes Avenue runs along the edge of the main campus, with the Cohon University Center and Tepper Quad on it. Fifth Avenue is a block or so further. Oakland, the University of Pittsburgh (Pitt), and Craig Street's shops are nearby.",
  },
  {
    terms: ["gesling", "stadium", "football", "track"],
    note: "Gesling Stadium: CMU's football field and running track, near the Cohon University Center.",
  },
  {
    terms: ["dorm", "dorms", "residence", "morewood", "donner", "mudge", "stever", "resnik"],
    note: "Many first-year students live in residence halls such as Morewood Gardens, Donner House, Stever House, Mudge House, and Resnik House. Morewood Gardens is across Forbes Avenue from the main campus.",
  },
  {
    terms: ["fence"],
    note: "The Fence: a wooden fence on the Cut that student groups paint, by tradition only by hand between midnight and sunrise.",
  },
  {
    terms: ["carnival", "spring carnival", "booth", "midway"],
    note: "Spring Carnival: a long weekend each April with Booth (small buildings that student groups build and decorate on the Midway, with games inside), Buggy races, rides, and alumni visiting.",
  },
  {
    terms: ["buggy", "sweepstakes"],
    note: "Buggy, or Sweepstakes: races during Spring Carnival in which teams push small aerodynamic vehicles with a driver lying inside along Schenley Drive in Schenley Park. Student organizations build the buggies and train all year.",
  },
  {
    terms: ["scotty", "mascot", "scottie", "terrier", "dog"],
    note: "Scotty: CMU's mascot, a Scottish terrier.",
  },
  {
    terms: ["tartan", "tartans", "plaid", "athletics", "sports", "team"],
    note: "The Tartans: the name of CMU's sports teams, after the Scottish plaid. The Tartan is also the student newspaper.",
  },
  {
    terms: ["kiltie", "kilties", "band", "bagpipe", "bagpipes", "kilt", "kilts"],
    note: "The Kiltie Band: CMU's band, which wears kilts in the school tartan. CMU also offers a degree in bagpipe performance.",
  },
  {
    terms: ["walking to the sky", "sculpture", "statue"],
    note: "Walking to the Sky: a tall outdoor sculpture of people walking up a pole into the sky, by Jonathan Borofsky.",
  },
  {
    terms: [
      "college",
      "colleges",
      "school",
      "cit",
      "engineering",
      "mcs",
      "science",
      "dietrich",
      "hss",
      "humanities",
      "heinz",
      "bxa",
      "ideate",
    ],
    note: "CMU's colleges: the College of Engineering (CIT), the College of Fine Arts (CFA), Dietrich College of Humanities and Social Sciences, the Heinz College of Information Systems and Public Policy, the Mellon College of Science (MCS), the School of Computer Science (SCS), and the Tepper School of Business. BXA programs combine the arts with another college, and IDeATe is a cross-college program in arts and technology.",
  },
  {
    terms: ["15-112", "112", "15-122", "122", "15-213", "213", "course", "class"],
    note: "Courses are known by number: 15-112 is the introductory programming course, 15-122 is Principles of Imperative Computation, and 15-213 is Introduction to Computer Systems.",
  },
  {
    terms: ["andrew", "andrew id"],
    note: "An Andrew ID is a CMU student's or employee's username for campus accounts, named after Andrew Carnegie and Andrew Mellon.",
  },
  {
    terms: ["scotch'n'soda", "scotch n soda", "scotch and soda", "wrct", "radio", "newspaper"],
    note: "Student groups include Scotch'n'Soda, a student theater group, and WRCT, the student radio station. The Tartan is the student newspaper.",
  },
];

function wordsOf(text: string): string {
  return ` ${text.toLowerCase().replaceAll(/[^a-z0-9'-]+/gu, " ")} `;
}

/** The notes that bear on this question about this secret: those whose terms appear in either. */
export function campusNotes(
  secret: { readonly name: string; readonly facts: readonly string[] },
  question: string,
  notes: readonly CampusNote[] = CAMPUS,
): string[] {
  const words = wordsOf([secret.name, ...secret.facts, question].join(" "));
  return notes
    .filter((entry) => entry.terms.some((term) => words.includes(` ${term} `)))
    .map((entry) => entry.note);
}
