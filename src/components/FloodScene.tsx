"use client";

import { getWaterlineCm, isImpassable } from "@/lib/floodScale";
import type { FloodDepthCode } from "@/lib/types";
import { useId } from "react";

/**
 * Front-facing traffic scene whose water level tracks the selected depth.
 *
 * ---------------------------------------------------------------------
 * One pixel is one centimetre
 * ---------------------------------------------------------------------
 * Drawn 1:1 with reality on both axes, so every dimension below is a real
 * measurement rather than a pleasing shape. Not fussiness: the component's
 * whole claim is "this is how deep the water is against a car and a
 * person", and a figure at the wrong height makes "knee level" land
 * somewhere that is not a knee.
 *
 * Keep new road users to real dimensions and the waterline stays honest.
 *
 * ---------------------------------------------------------------------
 * How the highlighting works
 * ---------------------------------------------------------------------
 * The scene is defined ONCE and drawn twice — neutral outline, then a
 * filled copy clipped to below the waterline. Cumulative highlighting
 * falls out of the geometry, so no part needs its own rule about when it
 * counts as submerged.
 */

const VB_W = 880;
const VB_H = 250;
/** Road surface. Heights are measured in centimetres up from here. */
const ROAD_Y = 232;

/** Height above the road, in cm, as an SVG y coordinate. */
const y = (cm: number) => ROAD_Y - cm;

/** Landmarks the depth labels are named after, on the standing figure. */
const PERSON = { top: 170, shoulder: 138, hip: 96, knee: 50 } as const;

/**
 * Front view of a wheel: tyre arc plus rim arc, sunk behind the arch so
 * only the lower part shows. Two arcs rather than a full circle — a plain
 * disc read as a bubble at this scale.
 */
function Wheel({ cx, r }: { cx: number; r: number }) {
  return (
    <>
      <path d={`M${cx - r} ${y(0)} a${r} ${r} 0 0 1 ${r * 2} 0`} />
      <path d={`M${cx - r * 0.52} ${y(0)} a${r * 0.52} ${r * 0.52} 0 0 1 ${r * 1.04} 0`} />
    </>
  );
}

/**
 * Front view of a car. Sedan and SUV share this: same anatomy, different
 * proportions. Duplicating it would mean fixing every drawing bug twice.
 */
function Car({
  x,
  width,
  height,
  cabinInset,
  beltline,
  bonnet,
}: {
  x: number;
  width: number;
  height: number;
  /** How far the cabin narrows in from the body on each side. */
  cabinInset: number;
  /** Height where glass meets bodywork. */
  beltline: number;
  /** Height of the bonnet's leading edge. */
  bonnet: number;
}) {
  const l = x;
  const r = x + width;
  const cx = x + width / 2;
  const archR = Math.round(height * 0.23);

  return (
    <>
      <path
        d={`M${l} ${y(0)}
            V${y(bonnet - 10)}
            C${l} ${y(bonnet + 6)} ${l + 5} ${y(beltline - 8)} ${l + 15} ${y(beltline)}
            L${l + cabinInset} ${y(height - 12)}
            Q${l + cabinInset + 5} ${y(height)} ${l + cabinInset + 17} ${y(height)}
            H${r - cabinInset - 17}
            Q${r - cabinInset - 5} ${y(height)} ${r - cabinInset} ${y(height - 12)}
            L${r - 15} ${y(beltline)}
            C${r - 5} ${y(beltline - 8)} ${r} ${y(bonnet + 6)} ${r} ${y(bonnet - 10)}
            V${y(0)}`}
      />
      <path
        d={`M${l + 19} ${y(beltline)}
            L${l + cabinInset + 5} ${y(height - 13)}
            H${r - cabinInset - 5}
            L${r - 19} ${y(beltline)} Z`}
      />
      <path d={`M${l + 9} ${y(bonnet)} H${r - 9}`} />
      <rect x={l + 13} y={y(bonnet - 13)} width="30" height="15" rx="7" />
      <rect x={r - 43} y={y(bonnet - 13)} width="30" height="15" rx="7" />
      <rect x={cx - 25} y={y(bonnet - 15)} width="50" height="11" rx="5" />
      <path d={`M${l + 7} ${y(36)} H${r - 7}`} />
      <path d={`M${l + 15} ${y(beltline + 3)} h-11`} />
      <path d={`M${r - 15} ${y(beltline + 3)} h11`} />
      <Wheel cx={l + archR + 8} r={archR} />
      <Wheel cx={r - archR - 8} r={archR} />
    </>
  );
}

export function FloodScene({
  code,
  className = "",
}: {
  code: FloodDepthCode;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const waterCm = getWaterlineCm(code);
  const impassable = isImpassable(code);
  const waterY = y(waterCm);

  const clipId = `fs-below-${uid}`;
  const sceneId = `fs-scene-${uid}`;
  const hazardId = `fs-hazard-${uid}`;
  const accent = impassable ? "var(--color-danger)" : "var(--color-brand)";

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className={className}
      style={{ height: "auto" }}
      preserveAspectRatio="xMidYMax meet"
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={clipId}>
          <rect
            className="mbb-scene-animated"
            x="0"
            y={waterY}
            width={VB_W}
            height={VB_H - waterY}
          />
        </clipPath>

        <pattern
          id={hazardId}
          width="18"
          height="18"
          patternTransform="rotate(45)"
          patternUnits="userSpaceOnUse"
        >
          <rect width="9" height="18" fill="var(--color-danger)" opacity=".2" />
        </pattern>

        <g id={sceneId}>
          {/* ---- Jeepney, 210cm wide x 212cm tall ---- */}
          <path
            d={`M24 ${y(0)} V${y(194)} Q24 ${y(212)} 46 ${y(212)}
                H212 Q234 ${y(212)} 234 ${y(194)} V${y(0)}`}
          />
          <path d={`M38 ${y(188)} H220 V${y(146)} H38 Z`} />
          <path d={`M129 ${y(188)} V${y(146)}`} />
          <rect x="92" y={y(136)} width="74" height="19" rx="5" />
          <rect x="38" y={y(74)} width="33" height="17" rx="8" />
          <rect x="187" y={y(74)} width="33" height="17" rx="8" />
          <rect x="101" y={y(72)} width="56" height="13" rx="5" />
          <path d={`M32 ${y(40)} H226`} />
          <Wheel cx={66} r={38} />
          <Wheel cx={192} r={38} />

          {/* ---- SUV, 190cm wide x 178cm tall ---- */}
          <Car x={266} width={190} height={178} cabinInset={26} beltline={112} bonnet={92} />

          {/* ---- Sedan, 180cm wide x 145cm tall ---- */}
          <Car x={488} width={180} height={145} cabinInset={24} beltline={92} bonnet={76} />

          {/* ---- Motorcycle, bars at 112cm. Needs visible mass or it
                  reads as an antenna rather than a vehicle. ---- */}
          <Wheel cx={716} r={30} />
          {/* fairing / tank */}
          <path
            d={`M702 ${y(36)} V${y(80)} Q702 ${y(94)} 716 ${y(94)}
                Q730 ${y(94)} 730 ${y(80)} V${y(36)} Z`}
          />
          {/* headlight */}
          <circle cx="716" cy={y(72)} r="10" />
          {/* forks down to the wheel */}
          <path d={`M708 ${y(36)} V${y(20)}`} />
          <path d={`M724 ${y(36)} V${y(20)}`} />
          {/* handlebars + mirrors */}
          <path d={`M692 ${y(112)} H740`} />
          <path d={`M716 ${y(94)} V${y(108)}`} />
          <path d={`M694 ${y(112)} V${y(122)}`} />
          <path d={`M738 ${y(112)} V${y(122)}`} />

          {/* ---- Pedestrian, 170cm. Knee 50, hip 96, shoulder 138 — the
                  landmarks the depth labels are named for. ---- */}
          <circle cx="804" cy={y(PERSON.top - 13)} r="13" />
          {/* Torso and arms as one silhouette — separate stick limbs read
              as a diagram of a person rather than a person. */}
          <path
            d={`M804 ${y(PERSON.shoulder + 6)}
                Q790 ${y(PERSON.shoulder + 6)} 787 ${y(PERSON.shoulder - 6)}
                L779 ${y(104)} L784 ${y(102)} L791 ${y(PERSON.shoulder - 22)}
                V${y(PERSON.hip)} H817 V${y(PERSON.shoulder - 22)}
                L824 ${y(102)} L829 ${y(104)} L821 ${y(PERSON.shoulder - 6)}
                Q818 ${y(PERSON.shoulder + 6)} 804 ${y(PERSON.shoulder + 6)} Z`}
          />
          {/* Legs with real width, and feet, so the knee landmark is
              visible rather than implied by a bend in a line. */}
          <path
            d={`M792 ${y(PERSON.hip)} V${y(PERSON.knee)} L791 ${y(4)}
                Q791 ${y(0)} 796 ${y(0)} H800 V${y(PERSON.knee)}
                V${y(PERSON.hip)} Z`}
          />
          <path
            d={`M808 ${y(PERSON.hip)} V${y(PERSON.knee)} V${y(4)}
                Q808 ${y(0)} 813 ${y(0)} H817 L816 ${y(PERSON.knee)}
                V${y(PERSON.hip)} Z`}
          />
        </g>
      </defs>

      <line
        x1="0"
        y1={ROAD_Y}
        x2={VB_W}
        y2={ROAD_Y}
        stroke="var(--color-border-strong)"
        strokeWidth="3"
      />

      <use
        href={`#${sceneId}`}
        fill="none"
        stroke="var(--color-ink-muted)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {waterCm > 0 && (
        <>
          <g clipPath={`url(#${clipId})`}>
            <use
              href={`#${sceneId}`}
              fill={accent}
              fillOpacity=".14"
              stroke={accent}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>

          {/* Flat and translucent — a public-safety diagram, so no waves,
              gradients or cartoon splash. */}
          <rect
            className="mbb-scene-animated"
            x="0"
            y={waterY}
            width={VB_W}
            height={VB_H - waterY}
            fill={impassable ? "var(--color-danger)" : "var(--color-brand-accent)"}
            fillOpacity={impassable ? ".18" : ".22"}
          />
          {impassable && (
            <rect
              x="0"
              y={waterY}
              width={VB_W}
              height={VB_H - waterY}
              fill={`url(#${hazardId})`}
            />
          )}
          <line
            style={{ transition: "y1 220ms ease-out, y2 220ms ease-out" }}
            x1="0"
            y1={waterY}
            x2={VB_W}
            y2={waterY}
            stroke={accent}
            strokeWidth="3.5"
          />
        </>
      )}
    </svg>
  );
}
