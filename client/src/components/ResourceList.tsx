import { useState, type ReactElement } from 'react';

import { useResources } from '../hooks/useResources';
import { RESOURCE_TYPES, type Resource, type ResourceType } from '../types/campushub';
import { cx } from '../utils/class-names';
import { Alert } from './Alert';
import { RESOURCE_TYPE_LABELS, ResourceCard } from './ResourceCard';
import styles from './ResourceList.module.css';

export interface ResourceListProps {
  readonly selectedResourceId: string | null;
  readonly onSelectResource: (resource: Resource) => void;
}

interface FilterOption {
  readonly value: ResourceType | null;
  readonly label: string;
}

const FILTER_OPTIONS: readonly FilterOption[] = [
  { value: null, label: 'All' },
  ...RESOURCE_TYPES.map((type): FilterOption => ({
    value: type,
    label: RESOURCE_TYPE_LABELS[type],
  })),
];

/** The campus catalogue as cards, filtered server-side by `GET /resources?type=`. */
export function ResourceList({
  selectedResourceId,
  onSelectResource,
}: ResourceListProps): ReactElement {
  const [typeFilter, setTypeFilter] = useState<ResourceType | null>(null);
  const { resources, isLoading, error, reload } = useResources(typeFilter);

  return (
    <section className={styles.panel} aria-labelledby="resource-list-heading">
      <div className={styles.toolbar}>
        <h2 id="resource-list-heading">Resource directory</h2>
        <div className={styles.filters} role="group" aria-label="Filter by resource type">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.label}
              type="button"
              className={cx(styles.filter, typeFilter === option.value && styles.filterActive)}
              aria-pressed={typeFilter === option.value}
              onClick={(): void => {
                setTypeFilter(option.value);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {error !== null && <Alert tone="error" message={error} onRetry={reload} />}

      {isLoading ? (
        <p className={styles.placeholder} aria-busy="true">
          Loading resources…
        </p>
      ) : error === null && resources.length === 0 ? (
        <p className={styles.placeholder}>No resources match this filter.</p>
      ) : (
        <div className={styles.grid}>
          {resources.map((resource) => (
            <ResourceCard
              key={resource.id}
              resource={resource}
              isSelected={resource.id === selectedResourceId}
              onSelect={onSelectResource}
            />
          ))}
        </div>
      )}
    </section>
  );
}
