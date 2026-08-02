export function filterLookupOptions(options, search, status) {
  const query = search.trim().toLowerCase();
  return options.filter((option) => {
    const matchesSearch = !query || option.label.toLowerCase().includes(query);
    const matchesStatus = !status || option.status === status;
    return matchesSearch && matchesStatus;
  });
}
