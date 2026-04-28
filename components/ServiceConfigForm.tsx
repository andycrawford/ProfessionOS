"use client";

import { useState, useEffect } from "react";
import type { ConfigField } from "@/services/types";
import styles from "./ServiceConfigForm.module.css";

interface ServiceConfigFormProps {
  fields: ConfigField[];
  values: Record<string, string | number | boolean>;
  onChange: (key: string, value: string | number | boolean) => void;
  disabled?: boolean;
}

/** Fetches label/value options from an endpoint for a dynamic-select field. */
function useDynamicOptions(endpoint: string | undefined) {
  const [options, setOptions] = useState<{ label: string; value: string }[]>([]);
  useEffect(() => {
    if (!endpoint) return;
    fetch(endpoint)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setOptions(data);
      })
      .catch(() => {});
  }, [endpoint]);
  return options;
}

function DynamicSelectField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: ConfigField;
  value: string;
  onChange: (key: string, value: string) => void;
  disabled: boolean;
}) {
  const options = useDynamicOptions(field.endpoint);

  return (
    <select
      id={field.key}
      className={styles.select}
      value={value}
      onChange={(e) => onChange(field.key, e.target.value)}
      disabled={disabled}
      required={field.required}
    >
      <option value="">Select…</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

/** Returns true if the field should be rendered given the current form values. */
function isVisible(
  field: ConfigField,
  values: Record<string, string | number | boolean>
): boolean {
  if (!field.visibleWhen) return true;
  const current = values[field.visibleWhen.field];
  return String(current ?? "") === field.visibleWhen.value;
}

export default function ServiceConfigForm({
  fields,
  values,
  onChange,
  disabled = false,
}: ServiceConfigFormProps) {
  const visibleFields = fields.filter((f) => isVisible(f, values));

  return (
    <div className={styles.form}>
      {visibleFields.map((field) => (
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
              ) : field.type === "dynamic-select" ? (
                <DynamicSelectField
                  field={field}
                  value={String(values[field.key] ?? "")}
                  onChange={onChange}
                  disabled={disabled}
                />
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
