import type { ReactElement } from 'react';

import { cx } from '../utils/class-names';
import styles from './Alert.module.css';

export type AlertTone = 'error' | 'success';

export interface AlertProps {
  readonly tone: AlertTone;
  readonly message: string;
  readonly title?: string;
  readonly onRetry?: () => void;
  readonly onDismiss?: () => void;
}

/** Inline banner for async outcomes; errors are announced immediately to screen readers. */
export function Alert({ tone, message, title, onRetry, onDismiss }: AlertProps): ReactElement {
  return (
    <div
      className={cx(styles.alert, tone === 'error' ? styles.error : styles.success)}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <div className={styles.body}>
        {title !== undefined && <p className={styles.title}>{title}</p>}
        <p>{message}</p>
      </div>
      <div className={styles.actions}>
        {onRetry !== undefined && (
          <button type="button" className={styles.action} onClick={onRetry}>
            Retry
          </button>
        )}
        {onDismiss !== undefined && (
          <button
            type="button"
            className={styles.action}
            onClick={onDismiss}
            aria-label="Dismiss message"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
