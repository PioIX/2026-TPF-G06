"use client"

export default function Input({ label, type = "text", value, onChange, placeholder, name, className = "", ariaLabel, autoComplete, required = false }) {
    return (
        <>
            {label && <label>{label}</label>}
            <input
                type={type}
                name={name}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className={className}
                aria-label={ariaLabel}
                autoComplete={autoComplete}
                required={required}
            />
        </>
    );
}