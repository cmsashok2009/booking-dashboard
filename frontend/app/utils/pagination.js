export const PAGE_SIZE = 10;

export function paginationItems(currentPage, totalPages) {
  const pages = new Set([1, 2, 3, totalPages - 2, totalPages - 1, totalPages]);
  for (let page = currentPage - 1; page <= currentPage + 1; page += 1) pages.add(page);
  const sorted = [...pages].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
  return sorted.flatMap((page, index) => {
    const previous = sorted[index - 1];
    return index > 0 && page - previous > 1 ? ["ellipsis", page] : [page];
  });
}

export function paged(rows, page) {
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  return rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
}
