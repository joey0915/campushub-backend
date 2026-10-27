import type { ReactElement } from 'react';

import type { Resource, ResourceType } from '../types/campushub';
import { cx } from '../utils/class-names';
import styles from './ResourceCard.module.css';

export const RESOURCE_TYPE_LABELS: Readonly<Record<ResourceType, string>> = {
  ROOM: 'Study Room',
  EQUIPMENT: 'Equipment',
  LAB: 'Lab',
};

export interface ResourceCardProps {
  readonly resource: Resource;
  readonly isSelected: boolean;
  readonly onSelect: (resource: Resource) => void;
}

export function ResourceCard({ resource, isSelected, onSelect }: ResourceCardProps): ReactElement {
  const handleSelect = (): void => {
    onSelect(resource);
  };

  return (
    <article className={cx(styles.card, isSelected && styles.selected)}>
      <div className={styles.header}>
        <span className={styles.type}>{RESOURCE_TYPE_LABELS[resource.type]}</span>
        <span className={resource.isAvailable ? styles.available : styles.unavailable}>
          {resource.isAvailable ? 'Available' : 'Unavailable'}
        </span>
      </div>
      <h3 className={styles.name}>{resource.name}</h3>
      <p className={styles.location}>{resource.location}</p>
      <button
        type="button"
        className={styles.select}
        onClick={handleSelect}
        disabled={!resource.isAvailable}
        aria-pressed={isSelected}
      >
        {isSelected ? 'Selected' : 'Book this'}
      </button>
    </article>
  );
}
