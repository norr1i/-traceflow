'use client'

/**
 * TraceFlow brand mark — "Trace Route"
 *
 * The mark is an offset-T path with three terminal nodes:
 *   ● ──────────────── ●   (horizontal trace)
 *                  |
 *                  ◉       (destination — accent node, focal point)
 *
 * The asymmetric branch reads simultaneously as:
 *   • A manufacturing flow diagram  (origin → junction → destination)
 *   • An abstract letter T          (for TraceFlow)
 *   • A routing/traceability symbol (QR-style industrial tech)
 */

type Size = 'sm' | 'md' | 'lg'

// svgSize is the rendered <svg> pixel size inside the container box
const dims: Record<Size, { box: number; svgSize: number; radius: string }> = {
  sm: { box: 32,  svgSize: 22, radius: 'rounded-[30%]' },
  md: { box: 40,  svgSize: 28, radius: 'rounded-[28%]' },
  lg: { box: 56,  svgSize: 40, radius: 'rounded-[26%]' },
}

export function LogoIcon({ size = 'md', className = '' }: { size?: Size; className?: string }) {
  const { box, svgSize, radius } = dims[size]

  return (
    <div
      style={{ width: box, height: box }}
      className={[
        'group/logo shrink-0 flex items-center justify-center select-none',
        radius,
        // deep navy gradient — max contrast so the mark pops
        'bg-gradient-to-br from-[#1b3f58] to-[#0d1e2c]',
        // resting glow + inset top-edge highlight
        'shadow-[0_0_16px_rgba(74,127,165,0.22),inset_0_1px_0_rgba(255,255,255,0.07)]',
        // hover: brighter glow, slight lift
        'hover:shadow-[0_0_28px_rgba(74,127,165,0.48),inset_0_1px_0_rgba(255,255,255,0.10)]',
        'transition-all duration-300 cursor-default',
        className,
      ].join(' ')}
    >
      <svg
        width={svgSize}
        height={svgSize}
        viewBox="0 0 28 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* ── Path lines ─────────────────────────────────────────── */}

        {/* Horizontal trace: left entry → right terminal */}
        <line
          x1="4.5" y1="8" x2="23.5" y2="8"
          stroke="rgba(211,209,206,0.30)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Vertical branch: junction → destination (asymmetric at ~68% from left) */}
        <line
          x1="18" y1="8" x2="18" y2="21.5"
          stroke="rgba(211,209,206,0.30)"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* ── Entry node — left terminus ──────────────────────────── */}
        <circle cx="4.5" cy="8" r="2.6" fill="#D3D1CE" fillOpacity="0.85" />

        {/* ── Right terminus — secondary, recessive ───────────────── */}
        <circle cx="23.5" cy="8" r="1.8" fill="#B3B7BA" fillOpacity="0.45" />

        {/* ── Junction node — subtle, at branch point ─────────────── */}
        <circle cx="18" cy="8" r="1.4" fill="#8aafca" fillOpacity="0.35" />

        {/* ── Destination / hero node — focal point ───────────────── */}

        {/* Outer halo */}
        <circle
          cx="18" cy="21.5" r="6"
          fill="#4a8fb9"
          fillOpacity="0.08"
          className="tf-logo-halo-1"
        />
        {/* Mid ring */}
        <circle
          cx="18" cy="21.5" r="4.2"
          fill="#4a8fb9"
          fillOpacity="0.14"
          className="tf-logo-halo-2"
        />
        {/* Main filled accent node */}
        <circle
          cx="18" cy="21.5" r="3"
          fill="#5fb3da"
          fillOpacity="0.96"
          className="tf-logo-node"
        />
        {/* Specular highlight — gives the node depth */}
        <circle cx="17" cy="20.5" r="1" fill="white" fillOpacity="0.38" />
      </svg>
    </div>
  )
}

export function LogoLockup({
  size = 'md',
  className = '',
}: {
  size?: Size
  className?: string
}) {
  const gap = size === 'sm' ? 'gap-2.5' : 'gap-3'

  // Typography scale
  const nameSize = size === 'sm' ? 'text-[13px]' : size === 'lg' ? 'text-[17px]' : 'text-[14px]'
  const subSize  = size === 'lg' ? 'text-[10.5px]' : 'text-[9.5px]'

  return (
    <div className={`flex items-center ${gap} ${className}`}>
      <LogoIcon size={size} />
      <div>
        {/*
          Two-tone wordmark: "Trace" (lighter, thinner) + "Flow" (brighter, bolder)
          Splits the brand name into a visual rhythm — same technique used by
          Linear, Vercel, and other premium SaaS marks.
        */}
        <p
          className={`leading-none tracking-[-0.025em] font-semibold text-[#D3D1CE] ${nameSize}`}
        >
          <span className="font-normal text-[#7dafc8]">Trace</span>Flow
        </p>
        {size !== 'sm' && (
          <p
            className={`mt-[3px] font-semibold tracking-[0.07em] uppercase text-[#4a5768] ${subSize}`}
          >
            Manufacturing OS
          </p>
        )}
      </div>
    </div>
  )
}
