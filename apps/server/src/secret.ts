/** The thing Bark is thinking of, and what he knows about it. */
export interface Secret {
  readonly name: string;
  /** Names a correct guess may use, lowercase. A question must mention one of these to win. */
  readonly aliases: readonly string[];
  /** What the judge answers from, alongside common knowledge. Never sent to the player. */
  readonly facts: readonly string[];
}

/**
 * The practice round. Its answer is no secret, since the page tells you once you are done; the daily puzzles will live in the database instead, so their answers stay out of this repository.
 */
export const PRACTICE: Secret = {
  name: "the Fence",
  aliases: ["fence"],
  facts: [
    "An outdoor wooden fence on the Cut, the lawn in the middle of Carnegie Mellon's campus, near the University Center.",
    "It is a campus landmark: a place people go to see it, meet at it, and paint it.",
    "Student groups paint it to advertise events, celebrate, or send messages; it has been painted so many times that the paint is many layers thick.",
    "By tradition it may only be painted by hand between midnight and sunrise, and groups guard it through the night to keep their paint up.",
    "Its colors change often, sometimes several times a week, so it rarely looks the same for long.",
    "It is a few meters long and about waist to chest high. You cannot go inside it. It is not a building.",
    "The first fence dates from the 1920s. It collapsed under the weight of its paint in 1993 and was replaced with a reinforced copy, so the tradition is old but the current fence is not.",
    "It is not food, not a person or animal, not a course, and not a website.",
  ],
};
