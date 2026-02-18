/**
 * GraphQL fragments and common queries/mutations for the Beans service.
 * These are shared between the VS Code extension and the MCP server.
 */

/**
 * Standard fragment for all Bean fields used throughout the application.
 */
export const BEAN_FIELDS = `
  fragment BeanFields on Bean {
    id
    slug
    path
    title
    body
    status
    type
    priority
    tags
    createdAt
    updatedAt
    etag
    parentId
    blockingIds
    blockedByIds
  }
`;

/**
 * Query to fetch a list of beans with filtering.
 */
export const LIST_BEANS_QUERY = `
  ${BEAN_FIELDS}
  query ListBeans($filter: BeanFilter) {
    beans(filter: $filter) {
      ...BeanFields
    }
  }
`;

/**
 * Query to fetch a single bean by ID.
 */
export const SHOW_BEAN_QUERY = `
  ${BEAN_FIELDS}
  query ShowBean($id: ID!) {
    bean(id: $id) {
      ...BeanFields
    }
  }
`;

/**
 * Mutation to create a new bean.
 */
export const CREATE_BEAN_MUTATION = `
  ${BEAN_FIELDS}
  mutation CreateBean($input: CreateBeanInput!) {
    createBean(input: $input) {
      ...BeanFields
    }
  }
`;

/**
 * Mutation to update an existing bean.
 */
export const UPDATE_BEAN_MUTATION = `
  ${BEAN_FIELDS}
  mutation UpdateBean($id: ID!, $input: UpdateBeanInput!) {
    updateBean(id: $id, input: $input) {
      ...BeanFields
    }
  }
`;

/**
 * Mutation to delete a bean.
 */
export const DELETE_BEAN_MUTATION = `
  mutation DeleteBean($id: ID!) {
    deleteBean(id: $id)
  }
`;
