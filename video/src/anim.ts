/**
 * anim.ts — the ONE per-frame pose timeline (Round 7B). Both the film
 * (HeroFilm) and the automated verifier (scripts/verify-all.ts) call
 * filmPose(frame): single source of truth so proofs can never drift.
 */
import { TIMELINE } from "./brand";
import { easeSine } from "./lib/motion";
import {
  A_UPRIGHT,
  B_TIRED,
  C_HEADHAND,
  D_RELIEF,
  E_LOOKUP,
  lerpAngles,
  type AnglePose,
} from "./rig";

/** loop target: the A_UPRIGHT pose with the forearms wrapped −360° so the
 *  return from behind-the-head is a short sweep, never through the desk. */
const A_LOOP: AnglePose = {
  ...A_UPRIGHT,
  foreN: A_UPRIGHT.foreN - 360,
  foreF: A_UPRIGHT.foreF - 360,
};

export const filmPose = (frame: number): AnglePose => {
  const T = TIMELINE;
  const slump = easeSine(frame, T.poseUprightToSlump.start, T.poseUprightToSlump.dur);
  const t1 = easeSine(frame, T.poseTiredToOverwhelmed.start, T.poseTiredToOverwhelmed.dur);
  const t2 = easeSine(frame, T.poseOverwhelmedToCalm.start, T.poseOverwhelmedToCalm.dur);
  const t4 = easeSine(frame, T.poseCalmToRest.start, T.poseCalmToRest.dur);
  const t3 = easeSine(frame, T.poseCalmToNeutral.start, T.poseCalmToNeutral.dur);
  return lerpAngles(
    lerpAngles(
      lerpAngles(
        lerpAngles(lerpAngles(A_UPRIGHT, B_TIRED, slump), C_HEADHAND, t1),
        E_LOOKUP,
        t2,
      ),
      D_RELIEF,
      t4,
    ),
    A_LOOP,
    t3,
  );
};
