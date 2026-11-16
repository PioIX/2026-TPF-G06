"use client"

export default function Button({ text, onClick, type = "button", className = "", disabled = false }) {
    return (
        <button
            type={type}
            onClick={onClick}
            className={className}
            disabled={disabled}
        >
            {text}
        </button>
    );
}