"use client";

import { forwardRef, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import clsx from "clsx";

interface BaseFieldProps {
  label: string;
  error?: string;
  hint?: string;
}

type InputFieldProps = BaseFieldProps & InputHTMLAttributes<HTMLInputElement> & {
  as?: "input";
};

type SelectFieldProps = BaseFieldProps & SelectHTMLAttributes<HTMLSelectElement> & {
  as: "select";
  options: { value: string; label: string }[];
};

type TextareaFieldProps = BaseFieldProps & TextareaHTMLAttributes<HTMLTextAreaElement> & {
  as: "textarea";
};

type FieldProps = InputFieldProps | SelectFieldProps | TextareaFieldProps;

export const Field = forwardRef<
  HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  FieldProps
>(function Field(props, ref) {
  const { label, error, hint, className, ...rest } = props;
  
  const baseInputStyles = clsx(
    "block w-full rounded-lg border-0 bg-white/5 px-4 py-3 text-white shadow-sm ring-1 ring-inset placeholder:text-slate-500 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6 transition-all",
    error
      ? "ring-red-500 focus:ring-red-500"
      : "ring-white/10 focus:ring-emerald-500"
  );

  return (
    <div className={clsx("space-y-2", className)}>
      <label className="block text-sm font-medium leading-6 text-slate-200">
        {label}
        {rest.required && <span className="text-red-400 ml-1">*</span>}
      </label>
      
      {props.as === "select" ? (
        <select
          ref={ref as React.Ref<HTMLSelectElement>}
          className={baseInputStyles}
          {...(rest as SelectHTMLAttributes<HTMLSelectElement>)}
        >
          <option value="" className="bg-slate-800 text-white">Select an option</option>
          {props.options.map((option) => (
            <option key={option.value} value={option.value} className="bg-slate-800 text-white">
              {option.label}
            </option>
          ))}
        </select>
      ) : props.as === "textarea" ? (
        <textarea
          ref={ref as React.Ref<HTMLTextAreaElement>}
          className={clsx(baseInputStyles, "min-h-[100px] resize-y")}
          {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input
          ref={ref as React.Ref<HTMLInputElement>}
          className={baseInputStyles}
          {...(rest as InputHTMLAttributes<HTMLInputElement>)}
        />
      )}
      
      {hint && !error && (
        <p className="text-sm text-slate-400">{hint}</p>
      )}
      
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
    </div>
  );
});
