import { useState, useCallback } from "react";
import { notifications } from "@mantine/notifications";
import { getApiError } from "../utils/error";

interface UseFormSubmitOptions<T> {
  onSuccess?: (result: T) => void;
  onError?: (err: unknown) => void;
  successMessage?: string;
  errorMessage?: string;
  showSuccessNotification?: boolean;
  showErrorNotification?: boolean;
}

interface UseFormSubmitReturn<T> {
  submit: (data: T) => Promise<void>;
  submitting: boolean;
  error: string | null;
}

export function useFormSubmit<T>(
  submitFn: (data: T) => Promise<any>,
  options?: UseFormSubmitOptions<T>,
): UseFormSubmitReturn<T> {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (data: T) => {
      setSubmitting(true);
      setError(null);
      try {
        const result = await submitFn(data);
        if (options?.showSuccessNotification !== false) {
          notifications.show({
            title: "Success",
            message: options?.successMessage ?? "Operation completed successfully.",
            color: "green",
          });
        }
        options?.onSuccess?.(result);
      } catch (err: unknown) {
        const message = getApiError(err);
        setError(message);
        if (options?.showErrorNotification !== false) {
          notifications.show({
            title: "Error",
            message: options?.errorMessage ?? message,
            color: "red",
          });
        }
        options?.onError?.(err);
      } finally {
        setSubmitting(false);
      }
    },
    [submitFn, options],
  );

  return { submit, submitting, error };
}
