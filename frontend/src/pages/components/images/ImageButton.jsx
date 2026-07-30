export default function ImageButton({ onClick, selected = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full border-2 border-secondary-500 px-3 py-1 min-h-8 transition duration-100 ease-in-out cursor-pointer ${selected ? "border-secondary-500 bg-secondary-500 text-primary-100" : "border-primary-200 bg-primary-100 text-primary-900 hover:border-secondary-500 hover:text-secondary-700"}`}
      aria-label="Upload product image"
      title="Upload product image"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="2"
        stroke="currentColor"
        className="w-5 h-5"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l.372.372a2.25 2.25 0 003.182 0l4.159-4.159a2.25 2.25 0 013.182 0L21.75 9.75m-19.5 6v2.25A2.25 2.25 0 004.5 20.25h15A2.25 2.25 0 0021.75 18v-10.5A2.25 2.25 0 0019.5 5.25h-15A2.25 2.25 0 002.25 7.5v8.25z"
        />
      </svg>
      <span className="hidden sm:inline text-sm font-medium">Image</span>
    </button>
  );
}