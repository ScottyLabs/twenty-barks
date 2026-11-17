// Adapted from ScottyLabs/tartanhacks-landing-2027 (src/bark), where Bark was first drawn from the ScottyLabs mark.

/** Small pieces of motion shared by Bark and the things he plays with. */

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** Eases from 0 to 1 as `t` does, slowly at both ends. */
export const smooth01 = (t: number): number => {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
};

/** The fraction of the way to a target to move in `dt`, settling in about `time` seconds. */
export const toward = (dt: number, time: number): number => 1 - Math.exp(-dt / time);

/** A value on a spring: it overshoots and settles, which is what makes soft parts look soft. */
export class Spring {
  value: number;
  velocity = 0;

  constructor(value: number) {
    this.value = value;
  }

  step(target: number, stiffness: number, damping: number, dt: number): void {
    // Two half steps keep a stiff spring stable on a slow frame.
    for (let i = 0; i < 2; i++) {
      const h = dt / 2;
      this.velocity += ((target - this.value) * stiffness - this.velocity * damping) * h;
      this.value += this.velocity * h;
    }
  }
}
