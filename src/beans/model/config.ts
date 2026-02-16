import { BeanPriority, BeanStatus, BeanType } from './Bean';

/**
 * Beans workspace configuration from .beans.yml
 */
export interface BeansConfig {
  /** Path to .beans/ directory */
  path: string;

  /** ID prefix for beans in this workspace */
  prefix: string;

  /** Length of the random ID suffix */
  id_length: number;

  /** Default status for new beans */
  default_status: BeanStatus;

  /** Default type for new beans */
  default_type: BeanType;

  /** Custom types configured for this workspace */
  types?: BeanType[];

  /** Custom statuses configured for this workspace */
  statuses?: BeanStatus[];

  /** Custom priorities configured for this workspace */
  priorities?: BeanPriority[];
}

/**
 * Beans initialization options
 */
export interface BeansInitOptions {
  /** Workspace prefix for bean IDs */
  prefix: string;

  /** Default type for new beans */
  defaultType?: BeanType;

  /** Default status for new beans */
  defaultStatus?: BeanStatus;

  /** Custom types for this workspace */
  types?: BeanType[];

  /** Custom statuses for this workspace */
  statuses?: BeanStatus[];

  /** Custom priorities for this workspace */
  priorities?: BeanPriority[];
}
