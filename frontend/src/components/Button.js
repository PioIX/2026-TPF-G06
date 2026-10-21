"use client"

export default function Button({ text, onClick, type = "button", className = "" }) {
    return (
        <button
            type={type}
            onClick={onClick}
            className={className}

        >
            {text}
        </button>
    );
}