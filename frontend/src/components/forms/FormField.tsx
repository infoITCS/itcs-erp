import { Children, isValidElement, type ReactNode } from "react";
import { cn } from "@/utils/cn.ts";

interface FormFieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

type RequiredControlProps = {
  required?: boolean;
  "aria-required"?: boolean | string;
};

function hasRequiredControl(children: ReactNode): boolean {
  return Children.toArray(children).some((child) => {
    if (!isValidElement<RequiredControlProps>(child)) {
      return false;
    }
    const { required, "aria-required": ariaRequired } = child.props;
    return required === true || ariaRequired === true || ariaRequired === "true";
  });
}

export function FormField({ label, htmlFor, error, required, children }: FormFieldProps) {
  const isRequired = required ?? hasRequiredControl(children);

  return (
    <div className="flex flex-col gap-1.5" data-invalid={error ? "true" : undefined}>
      <label
        htmlFor={htmlFor}
        className={cn("text-sm font-medium", error ? "text-red-700" : "text-slate-700")}
      >
        {label}
        {isRequired ? (
          <>
            <span className="ml-0.5 text-red-600" aria-hidden="true">
              *
            </span>
            <span className="sr-only"> (required)</span>
          </>
        ) : null}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-red-700" role="alert" aria-live="polite">
          {error}
        </p>
      ) : null}
    </div>
  );
}
