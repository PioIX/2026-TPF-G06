"use client"


export default function Input({ label, type = "text", value, onChange, placeholder, name }) {
    return (
        <div >
            {label && <label >{label}</label>}
            <input
                type={type}
                name={name}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                
            />
        </div>
    );
}