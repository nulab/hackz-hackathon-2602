export const IdleScreen = () => (
  <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
    <div className="animate-pulse flex flex-col items-center gap-4">
      <svg
        className="w-16 h-16 text-white/30"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7.5 7.5h-.75A2.25 2.25 0 004.5 9.75v7.5a2.25 2.25 0 002.25 2.25h7.5a2.25 2.25 0 002.25-2.25v-7.5a2.25 2.25 0 00-2.25-2.25h-.75m-6 3.75l3 3m0 0l3-3m-3 3V1.5"
        />
      </svg>
      <p className="text-white/30 text-2xl font-bold">NFC をスキャンしてね</p>
    </div>
  </div>
);
