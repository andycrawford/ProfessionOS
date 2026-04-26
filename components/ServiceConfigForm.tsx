import type { ConfigField } from "@/services/types";
import styles from "./ServiceConfigForm.module.css";

interface ServiceConfigFormProps {
  fields: ConfigField[];
  values: Record<string, string | number | boolean>;
  onChange: (key: string, value: string | number | boolean) => void;
  disabled?: boolean;
}

export default function ServiceConfigForm({
  fields,
  values,
  onChange,
  disabled = false,
}: ServiceConfigFormProps) {
  return (
    <div className={styles.form}>
      {fields.map((field) => (
        <div key={field.key} className={styles.field}>
          {field.type === "checkbox" ? (
            <div className={styles.checkboxRow}>
              <input
                id={field.key}
                type="checkbox"
                className={styles.checkbox}
                checked={Boolean(values[field.key])}
                onChange={(e) => onChange(field.key, e.target.checked)}
                disabled={disabled}
              />
              <label htmlFor={field.key} className={styles.checkboxLabel}>
                {field.label}
                {field.required && (
                  <span className={styles.required} aria-hidden="true">
                    {" "}*
                  </span>
                )}
              </label>
              {field.description && (
                <p className={styles.description}>{field.description}</p>
              )}
            </div>
          ) : (
            <>
              <label htmlFor={field.key} className={styles.label}>
                {field.label}
                {field.required && (
                  <span className={styles.required} aria-hidden="true">
                    *
                  </span>
                )}
              </label>
              {field.type === "select" ? (
                <select
                  id={field.key}
                  className={styles.select}
                  value={String(values[field.key] ?? "")}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  disabled={disabled}
                  required={field.required}
                >
                  <option value="">Select…</option>
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={field.key}
                  type={field.type}
                  className={styles.input}
                  value={String(values[field.key] ?? "")}
                  placeholder={field.placeholder}
                  onChange={(e) =>
                    onChange(
                      field.key,
                      field.type === "number"
                        ? Number(e.target.value)
                        : e.target.value
                    )
                  }
                  disabled={disabled}
                  required={field.required}
                  autoComplete={field.type === "password" ? "current-password" : undefined}
                />
              )}
              {field.description && (
                <p className={styles.description}>{field.description}</p>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
