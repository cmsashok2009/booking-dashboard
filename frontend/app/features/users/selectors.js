export function filterAndSortUsers(users, filters) {
  const search = filters.search.trim().toLowerCase();
  return [...users]
    .filter((item) => item.role !== "Admin")
    .filter((item) => {
      const matchesSearch =
        !search ||
        [item.name, item.email, item.phone, item.role, item.region, item.reportingManagerEmail, item.status]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));
      return (
        matchesSearch &&
        (!filters.role || item.role === filters.role) &&
        (!filters.region || item.region === filters.region) &&
        (!filters.status || item.status === filters.status)
      );
    })
    .sort((left, right) => {
      const result = String(left[filters.sortKey] || "").localeCompare(String(right[filters.sortKey] || ""));
      return filters.sortDir === "asc" ? result : -result;
    });
}
