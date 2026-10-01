import { useState } from "react";

export default function PasswordInput({ value, onChange, placeholder, autoComplete, className, style }) {
  const [visible, setVisible] = useState(false);
  const hide = () => setVisible(false);

  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={className}
        style={{ ...style, paddingRight: 52, boxSizing: "border-box" }}
      />
      <button
        type="button"
        aria-label="Tahan untuk melihat password"
        aria-pressed={visible}
        title="Tahan untuk melihat password"
        onPointerDown={(event) => {
          event.preventDefault();
          setVisible(true);
        }}
        onPointerUp={hide}
        onPointerCancel={hide}
        onPointerLeave={hide}
        onBlur={hide}
        onKeyDown={(event) => {
          if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            setVisible(true);
          }
        }}
        onKeyUp={hide}
        className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-gray-500 hover:text-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-green-800"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
          {visible ? (
            <>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.5 9 7-.2 1-1 2.1-2.1 3.1M6.2 6.2C4 7.6 2.4 9.8 2 12c.5 2.5 4 7 10 7 1 0 1.9-.2 2.8-.5" />
            </>
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
          )}
          {!visible && <circle cx="12" cy="12" r="3" />}
        </svg>
      </button>
    </div>
  );
}