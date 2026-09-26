'use client';
/**
 * TeamsExperience — the portal and the Teams world, DOM side.
 *
 *   PortalHold      the portal's TOUCH & HOLD prompt and hit target
 *   TeamsHud        the domain index, caption, hints, cursor, the pull back,
 *                   and the closing plate
 *   DomainDetail    an open domain, set on its card's glass
 *   TeamsInput      the InteractionController: pointer, tap, wheel / swipe,
 *                   keys → the per-frame channel and the actions
 *
 * The WebGL side lives in the one canvas: the portal (PortalEntry) inside the
 * events corridor, the TeamsWorld scene and PostProcessing (mounted by
 * SceneDirector / ExperienceCanvas), all driven by the same CameraRig.
 * See docs/TEAMS_WORLD.md.
 */
import { DomainDetail } from './ui/DomainDetail';
import { PortalHold } from './ui/PortalHold';
import { TeamsHud } from './ui/TeamsHud';
import { TeamsInput } from './ui/TeamsInput';

export function TeamsExperience() {
  return (
    <>
      <PortalHold />
      <TeamsHud />
      <DomainDetail />
      <TeamsInput />
    </>
  );
}
