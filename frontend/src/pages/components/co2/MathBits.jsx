// Typeset maths for the CO₂ formulas: a stacked fraction and italic serif variables, so a formula
// reads like a formula (as in the design), not like a line of code.

/** An italic variable, optionally with a subscript: <V s="i">c</V> -> cᵢ */
export function V({ children, s }) {
  return (
    <span className="font-display italic">
      {children}{s !== undefined && <sub className="text-[0.62em] not-italic align-baseline relative top-[0.28em] ml-px">{s}</sub>}
    </span>
  );
}

/** A stacked fraction. `top` and `bottom` are React nodes. */
export function Frac({ top, bottom, className = "" }) {
  return (
    <span className={`inline-flex flex-col items-center align-middle mx-1 ${className}`}>
      <span className="px-1.5 pb-1 leading-tight">{top}</span>
      <span className="self-stretch border-t-[1.5px] border-current opacity-80" aria-hidden="true" />
      <span className="px-1.5 pt-1 leading-tight">{bottom}</span>
    </span>
  );
}

/** A value inside a formula, in a soft green pill. */
export function Pill({ children, dark = false, className = "" }) {
  return (
    <span className={`inline-block rounded-md px-1.5 py-0.5 font-semibold ${dark ? "bg-[#1B4D31] text-white" : "bg-[#E3F0E5] text-[#1F5D3A]"} ${className}`}>
      {children}
    </span>
  );
}

/** "CO₂" written in the display face, with a real subscript. */
export function CO2({ className = "" }) {
  return <span className={`font-display ${className}`}>CO<sub className="text-[0.62em] align-baseline relative top-[0.25em]">2</sub></span>;
}
