interface FormFieldProps {
  label: string
  required?: boolean
  error?: string
  hint?: string
  children: React.ReactNode
}

export function FormField({ label, required, error, hint, children }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-slate-700">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export function Input({ error, className = '', ...props }: InputProps) {
  return (
    <input
      className={`w-full px-3 py-2 text-sm border rounded-lg bg-white text-slate-800 placeholder-slate-400
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
        ${error ? 'border-red-400' : 'border-slate-300'}
        disabled:bg-slate-50 disabled:text-slate-400
        ${className}`}
      {...props}
    />
  )
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
}

export function Select({ error, className = '', children, ...props }: SelectProps) {
  return (
    <select
      className={`w-full px-3 py-2 text-sm border rounded-lg bg-white text-slate-800
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
        ${error ? 'border-red-400' : 'border-slate-300'}
        disabled:bg-slate-50 disabled:text-slate-400
        ${className}`}
      {...props}
    >
      {children}
    </select>
  )
}

export function Textarea({ error, className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
  return (
    <textarea
      className={`w-full px-3 py-2 text-sm border rounded-lg bg-white text-slate-800 placeholder-slate-400
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none
        ${error ? 'border-red-400' : 'border-slate-300'}
        ${className}`}
      {...props}
    />
  )
}
