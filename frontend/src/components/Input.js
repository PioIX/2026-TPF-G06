"use client";

export default function Input({ type = "text", placeholder, value, onChange, className = "", required = false }) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      required={required}
      className={`border border-gray-300 p-2 rounded w-full outline-none focus:border-blue-500 text-black ${className}`}
    />
  );
}