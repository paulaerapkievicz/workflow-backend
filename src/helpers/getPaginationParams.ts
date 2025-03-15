export function getPaginationParams(query: Record<string, any>): [page: number, perPage: number] {
  const page = parseInt(query.page ?? '', 10);
  const perPage = parseInt(query.perPage ?? '', 10);

  const perPageNumber = !isNaN(perPage) && perPage > 0 ? perPage : 10;
  const pageNumber = !isNaN(page) && page > 0 ? page : 1;

  return [pageNumber, perPageNumber];
}
